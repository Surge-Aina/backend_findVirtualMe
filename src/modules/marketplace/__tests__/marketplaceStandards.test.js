const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const { mountPublicApi } = require("../../public-api/mount");
const { signWebhookPayload } = require("../../public-api/webhookSignature");
const { flushLifecycleEvents } = require("../../public-api/lifecycleEvents");
const { API_VERSION } = require("../../public-api/apiVersion");
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
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    global.fetch = jest.fn(async () => ({ status: 200, text: async () => "{\"ok\":true}" }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("installs per site, signs app webhooks, and registers fields and workflows", async () => {
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
        scopes: ["sites:read", "custom_fields:write", "workflows:write"],
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
        scope: "sites:read custom_fields:write workflows:write",
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
    const installCall = global.fetch.mock.calls.find((call) => String(call[1].body).includes("app.installed"));
    expect(installCall[0]).toBe("https://hooks.example.test/app");
    const installBody = installCall[1].body;
    const timestamp = installCall[1].headers["X-FindVirtualMe-Timestamp"];
    expect(installCall[1].headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(webhookSecret, timestamp, installBody)}`
    );
    expect(installBody).not.toContain(webhookSecret);

    const bearer = `Bearer ${token.body.access_token}`;
    const me = await request(app).get("/api/public/v1/me").set("Authorization", bearer).set("Version", API_VERSION);
    expect(me.status).toBe(200);
    expect(me.headers.version).toBe(API_VERSION);
    expect(me.body.data.siteId).toBe(site._id.toString());

    const wrongVersion = await request(app)
      .get("/api/public/v1/me")
      .set("Authorization", bearer)
      .set("Version", "2021-07-28");
    expect(wrongVersion.status).toBe(400);
    expect(wrongVersion.body.error.code).toBe("unsupported_version");

    const sites = await request(app).get("/api/public/v1/sites").set("Authorization", bearer);
    expect(sites.body.data.map((item) => item.id)).toEqual([site._id.toString()]);

    const field = await request(app)
      .post(`/api/public/v1/sites/${site._id}/custom-fields`)
      .set("Authorization", bearer)
      .send({ key: "membership_tier", name: "Membership tier", dataType: "text" });
    expect(field.status).toBe(201);
    const foreign = await request(app)
      .post(`/api/public/v1/sites/${other._id}/custom-fields`)
      .set("Authorization", bearer)
      .send({ key: "membership_tier", name: "Membership tier", dataType: "text" });
    expect(foreign.status).toBe(404);

    const action = await request(app)
      .post(`/api/public/v1/sites/${site._id}/workflow-actions`)
      .set("Authorization", bearer)
      .send({
        key: "notify_partner",
        name: "Notify partner",
        targetUrl: "https://hooks.example.test/action",
      });
    expect(action.status).toBe(201);
    const actionSecret = action.body.signingSecret;
    expect(JSON.stringify(action.body.data)).not.toContain(actionSecret);

    const trigger = await request(app)
      .post(`/api/public/v1/sites/${site._id}/workflow-triggers`)
      .set("Authorization", bearer)
      .send({ key: "pass_added", name: "Pass added", samplePayload: { reference: "example" } });
    expect(trigger.status).toBe(201);

    const fired = await request(app)
      .post(`/api/public/v1/sites/${site._id}/workflow-triggers/pass_added/fire`)
      .set("Authorization", bearer)
      .send({ payload: { reference: "example" } });
    expect(fired.status).toBe(202);
    await flushLifecycleEvents();
    const triggerCall = global.fetch.mock.calls.find((call) =>
      String(call[1].body).includes("workflow.trigger.fired")
    );
    expect(triggerCall[0]).toBe("https://hooks.example.test/app");

    const executed = await request(app)
      .post(`/api/public/v1/sites/${site._id}/workflow-actions/notify_partner/execute`)
      .set("Authorization", bearer)
      .send({ payload: { reference: "example" } });
    expect(executed.status).toBe(200);
    expect(executed.body.data.statusCode).toBe(200);
    const actionCall = global.fetch.mock.calls.find((call) => call[0] === "https://hooks.example.test/action");
    const actionTimestamp = actionCall[1].headers["X-FindVirtualMe-Timestamp"];
    expect(actionCall[1].headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(actionSecret, actionTimestamp, actionCall[1].body)}`
    );
  });
});
