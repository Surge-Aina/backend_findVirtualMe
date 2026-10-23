const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const { mountPublicApi } = require("../../public-api/mount");
const { mountMcp } = require("../../public-api/mcp");
const { setWebhookTransport, resetWebhookTransport } = require("../../public-api/webhookUrls");
const { signWebhookPayload } = require("../../public-api/webhookSignature");
const { dispatchLeadCaptured, flushLifecycleEvents } = require("../../public-api/lifecycleEvents");
const ContactMeForm = require("../../contact/contactMeForm.model");
const {
  developerApps,
  adminApps,
  oauth,
} = require("../marketplace.routes");

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const app = express();
app.use(express.json());
app.use("/api/developer/apps", developerApps);
app.use("/api/admin/apps", adminApps);
app.use("/api/oauth", oauth);
mountPublicApi(app);
mountMcp(app);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function sessionFor(user) {
  return `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "20m" })}`;
}

async function createUser(tag, role = "customer") {
  const id = nonce();
  return User.create({
    username: `acct_${tag}_${id}`,
    email: `mailbox.${tag}.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role,
  });
}

describe("marketplace standards", () => {
  const calls = [];

  beforeEach(() => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    calls.length = 0;
    setWebhookTransport(async (url, init) => {
      calls.push([url, init]);
      return { status: 200 };
    });
  });

  afterEach(() => {
    resetWebhookTransport();
  });

  it("installs per site and signs the app.installed event", async () => {
    const developer = await createUser("dev");
    const admin = await createUser("admin", "admin");
    const owner = await createUser("owner");
    const site = await Portfolio.create({
      owner: owner._id,
      slug: `site${nonce()}`,
      title: "Synthetic Site",
      template: "healthcare",
      visibility: "public",
    });
    const other = await Portfolio.create({
      owner: owner._id,
      slug: `other${nonce()}`,
      title: "Other Site",
      template: "healthcare",
      visibility: "public",
    });

    const registered = await request(app)
      .post("/api/developer/apps")
      .set("Authorization", sessionFor(developer))
      .send({
        name: "Sample Partner",
        redirectUris: ["https://hooks.example.test/callback"],
        webhookUrl: "https://hooks.example.test/app",
        scopes: ["sites:read", "profile:read", "webhooks:write", "leads:read"],
      });
    expect(registered.status).toBe(201);
    const webhookSecret = registered.body.webhookSecret;
    expect(webhookSecret.startsWith("whsec_")).toBe(true);
    expect(JSON.stringify(registered.body.data)).not.toContain(webhookSecret);

    await request(app)
      .post(`/api/admin/apps/${registered.body.data.id}/review`)
      .set("Authorization", sessionFor(admin))
      .send({ reviewStatus: "approved" });

    const chooser = await request(app)
      .get("/api/oauth/authorize")
      .query({ response_type: "code", client_id: registered.body.data.clientId })
      .set("Authorization", sessionFor(owner));
    expect(chooser.status).toBe(200);
    expect(chooser.body.data.map((item) => item.id)).toContain(site._id.toString());

    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const consent = await request(app)
      .get("/api/oauth/authorize")
      .query({
        response_type: "code",
        client_id: registered.body.data.clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read profile:read leads:read",
        state: "state_synthetic",
        code_challenge: challenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      })
      .set("Authorization", sessionFor(owner))
      .redirects(0);
    expect(consent.status).toBe(302);
    const location = new URL(consent.headers.location);
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await request(app)
      .post("/api/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://hooks.example.test/callback",
        client_id: registered.body.data.clientId,
        client_secret: registered.body.clientSecret,
        code_verifier: verifier,
      });
    expect(token.status).toBe(200);
    expect(token.body.site_id).toBe(site._id.toString());
    expect(token.body.expires_in).toBe(3600);

    await flushLifecycleEvents();
    const installCall = calls.find((call) => String(call[1].body).includes("app.installed"));
    expect(installCall[0]).toBe("https://hooks.example.test/app");
    const installBody = installCall[1].body;
    const timestamp = installCall[1].headers["X-FindVirtualMe-Timestamp"];
    expect(installCall[1].headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(webhookSecret, timestamp, installBody)}`
    );
    expect(installBody).not.toContain(webhookSecret);
    const installed = JSON.parse(installBody);
    expect(installed.apiVersion).toBe("2026-10-23");
    expect(installCall[1].headers["X-FindVirtualMe-Api-Version"]).toBe("2026-10-23");

    const submittedEmail = "Visitor@Example.TEST";
    const saved = await ContactMeForm.create({
      portfolioId: site._id,
      ownerEmail: "owner@example.test",
      ownerName: "Owner Example",
      name: "Visitor Example",
      email: submittedEmail,
      message: "Hello",
      consentContact: true,
    });
    await dispatchLeadCaptured({
      siteId: site._id,
      leadId: saved._id,
      email: submittedEmail,
      name: "Visitor Example",
      consent: { contact: true },
      createdAt: saved.createdAt,
    });
    await flushLifecycleEvents();
    const leadCall = calls.find((call) => String(call[1].body).includes("lead.captured"));
    expect(leadCall[0]).toBe("https://hooks.example.test/app");
    const leadBody = JSON.parse(leadCall[1].body);
    const leadTimestamp = leadCall[1].headers["X-FindVirtualMe-Timestamp"];
    expect(leadCall[1].headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(webhookSecret, leadTimestamp, leadCall[1].body)}`
    );
    expect(leadCall[1].headers["X-FindVirtualMe-Api-Version"]).toBe("2026-10-23");
    expect(leadBody.apiVersion).toBe("2026-10-23");
    expect(leadBody.appId).toBe(installed.data.appId);
    expect(leadBody.installationId).toBe(installed.data.installationId);
    expect(leadBody.data.leadId).toBe(saved._id.toString());
    expect(leadBody.data.email).toBe(submittedEmail);
    expect(leadBody.data.consent).toEqual({ contact: true });

    const bearer = `Bearer ${token.body.access_token}`;
    const ownLead = await request(app)
      .get(`/api/public/v1/leads/${saved._id}`)
      .set("Authorization", bearer);
    expect(ownLead.status).toBe(200);
    expect(ownLead.body.data.email).toBe(submittedEmail);
    expect(ownLead.body.data.consent).toEqual({ contact: true });
    expect(JSON.stringify(ownLead.body)).not.toContain("owner@example.test");

    const otherLead = await ContactMeForm.create({
      portfolioId: other._id,
      ownerEmail: "owner@example.test",
      ownerName: "Owner Example",
      name: "Other Visitor",
      email: "other@example.test",
      message: "Elsewhere",
    });
    const hiddenLead = await request(app)
      .get(`/api/public/v1/leads/${otherLead._id}`)
      .set("Authorization", bearer);
    expect(hiddenLead.status).toBe(404);
    const me = await request(app).get("/api/public/v1/me").set("Authorization", bearer);
    expect(me.status).toBe(200);
    expect(me.body.data.siteId).toBe(site._id.toString());

    const sites = await request(app).get("/api/public/v1/sites").set("Authorization", bearer);
    expect(sites.body.data.map((item) => item.id)).toEqual([site._id.toString()]);

    const foreign = await request(app)
      .get(`/api/public/v1/sites/${other._id}`)
      .set("Authorization", bearer);
    expect(foreign.status).toBe(404);

    const profile = await request(app)
      .get("/api/public/v1/business-profile")
      .set("Authorization", bearer);
    expect(profile.status).toBe(200);
    expect(profile.body.data.siteId).toBe(site._id.toString());

    const mcpSites = await request(app)
      .post("/api/mcp")
      .set("Authorization", bearer)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "list_sites", arguments: {} },
      });
    const mcpText = JSON.stringify(mcpSites.body);
    expect(mcpText).toContain(site._id.toString());
    expect(mcpText).not.toContain(other._id.toString());

    const mcpForeign = await request(app)
      .post("/api/mcp")
      .set("Authorization", bearer)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "get_site", arguments: { siteId: other._id.toString() } },
      });
    expect(JSON.stringify(mcpForeign.body)).toContain("not_found");
    expect(JSON.stringify(mcpForeign.body)).not.toContain(other._id.toString());

    const mcpHooks = await request(app)
      .post("/api/mcp")
      .set("Authorization", bearer)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "list_webhooks", arguments: {} },
      });
    expect(JSON.stringify(mcpHooks.body)).toContain("insufficient_scope");

    const mcpOtherLead = await request(app)
      .post("/api/mcp")
      .set("Authorization", bearer)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "get_lead", arguments: { leadId: otherLead._id.toString() } },
      });
    const mcpLeadText = JSON.stringify(mcpOtherLead.body);
    expect(mcpLeadText).toContain("not_found");
    expect(mcpLeadText).not.toContain("other@example.test");
    expect(JSON.stringify(installBody)).not.toContain(owner.email);
  });
});
