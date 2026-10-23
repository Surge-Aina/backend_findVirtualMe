const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const { mountPublicApi } = require("../../public-api/mount");
const { setWebhookTransport, resetWebhookTransport } = require("../../public-api/webhookUrls");
const { WebhookEndpoint } = require("../../public-api/webhookEndpoint.model");
const {
  developerApps,
  developerInstallations,
  adminApps,
  catalog,
  oauth,
} = require("../marketplace.routes");

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

const app = express();
app.use(express.json());
app.use("/api/developer/apps", developerApps);
app.use("/api/developer/installations", developerInstallations);
app.use("/api/admin/apps", adminApps);
app.use("/api/marketplace/apps", catalog);
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

describe("marketplace install", () => {
  beforeEach(() => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    setWebhookTransport(async () => ({ status: 200 }));
  });

  afterEach(() => {
    resetWebhookTransport();
  });

  it("installs an approved app with PKCE and lets it subscribe to events", async () => {
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

    const registered = await request(app)
      .post("/api/developer/apps")
      .set("Authorization", sessionFor(developer))
      .send({
        name: "Sample Partner",
        description: "A generic app",
        redirectUris: ["https://hooks.example.test/callback"],
        scopes: ["sites:read", "webhooks:write", "profile:read"],
      });
    expect(registered.status).toBe(201);
    const clientSecret = registered.body.clientSecret;
    const clientId = registered.body.data.clientId;
    expect(clientSecret.startsWith("fvm_sec_")).toBe(true);
    expect(JSON.stringify(registered.body.data)).not.toContain(clientSecret);

    const hidden = await request(app).get("/api/marketplace/apps");
    expect(hidden.body.data).toEqual([]);

    const approved = await request(app)
      .post(`/api/admin/apps/${registered.body.data.id}/review`)
      .set("Authorization", sessionFor(admin))
      .send({ reviewStatus: "approved" });
    expect(approved.status).toBe(200);

    const listed = await request(app).get("/api/marketplace/apps");
    expect(listed.body.data.map((item) => item.clientId)).toContain(clientId);
    expect(JSON.stringify(listed.body)).not.toContain(clientSecret);

    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const consent = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read webhooks:write",
        state: "state_synthetic",
        code_challenge: challenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    expect(consent.status).toBe(200);
    expect(consent.body.redirect_url).toContain("code=");
    expect(consent.body.redirect_url).toContain("state=state_synthetic");

    const token = await request(app).post("/api/oauth/token").send({
      grant_type: "authorization_code",
      code: consent.body.code,
      redirect_uri: "https://hooks.example.test/callback",
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    });
    expect(token.status).toBe(200);
    expect(token.body.access_token.startsWith("fvm_at_")).toBe(true);
    expect(token.body.token_type).toBe("Bearer");

    const me = await request(app)
      .get("/api/public/v1/me")
      .set("Authorization", `Bearer ${token.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(owner._id.toString());

    const sites = await request(app)
      .get("/api/public/v1/sites")
      .set("Authorization", `Bearer ${token.body.access_token}`);
    expect(sites.status).toBe(200);
    expect(sites.body.data[0].id).toBe(site._id.toString());

    const hook = await request(app)
      .post("/api/public/v1/webhooks")
      .set("Authorization", `Bearer ${token.body.access_token}`)
      .send({
        url: "https://hooks.example.test/events",
        events: ["lead.captured", "app.uninstalled"],
      });
    expect(hook.status).toBe(201);
    const stored = await WebhookEndpoint.findById(hook.body.data.id).lean();
    expect(String(stored.installationId)).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(hook.body.secret);

    const removed = await request(app)
      .delete(`/api/developer/installations/${stored.installationId}`)
      .set("Authorization", sessionFor(owner));
    expect(removed.status).toBe(200);
    expect(removed.body.data.status).toBe("uninstalled");

    const after = await request(app)
      .get("/api/public/v1/me")
      .set("Authorization", `Bearer ${token.body.access_token}`);
    expect(after.status).toBe(401);
  });

  it("requires approval, burns a code after one use, and revokes a reused refresh token", async () => {
    const developer = await createUser("dev2");
    const admin = await createUser("admin2", "admin");
    const owner = await createUser("owner2");
    const stranger = await createUser("stranger2");
    const site = await Portfolio.create({
      owner: owner._id,
      slug: `site${nonce()}`,
      title: "Synthetic Site",
      template: "healthcare",
      visibility: "public",
    });
    const foreign = await Portfolio.create({
      owner: stranger._id,
      slug: `foreign${nonce()}`,
      title: "Foreign Site",
      template: "healthcare",
      visibility: "public",
    });

    const registered = await request(app)
      .post("/api/developer/apps")
      .set("Authorization", sessionFor(developer))
      .send({
        name: "Guarded Partner",
        redirectUris: ["https://hooks.example.test/callback"],
        scopes: ["sites:read"],
      });
    expect(registered.status).toBe(201);
    const clientId = registered.body.data.clientId;
    const clientSecret = registered.body.clientSecret;

    const pending = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: "a".repeat(43),
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    expect(pending.status).toBe(400);

    const customerReview = await request(app)
      .post(`/api/admin/apps/${registered.body.data.id}/review`)
      .set("Authorization", sessionFor(owner))
      .send({ reviewStatus: "approved" });
    expect(customerReview.status).toBe(403);

    await request(app)
      .post(`/api/admin/apps/${registered.body.data.id}/review`)
      .set("Authorization", sessionFor(admin))
      .send({ reviewStatus: "approved" });

    const plain = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: "plain-verifier-plain-verifier-plain-ver",
        code_challenge_method: "plain",
        site_id: site._id.toString(),
      });
    expect(plain.status).toBe(400);

    const otherSite = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: crypto.createHash("sha256").update("x".repeat(43)).digest("base64url"),
        code_challenge_method: "S256",
        site_id: foreign._id.toString(),
      });
    expect(otherSite.status).toBe(404);

    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const consent = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: challenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    expect(consent.status).toBe(200);

    const wrongRedirect = await request(app).post("/api/oauth/token").send({
      grant_type: "authorization_code",
      code: consent.body.code,
      redirect_uri: "https://hooks.example.test/callback/extra",
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    });
    expect(wrongRedirect.status).toBe(400);
    const burnedRedirect = await request(app).post("/api/oauth/token").send({
      grant_type: "authorization_code",
      code: consent.body.code,
      redirect_uri: "https://hooks.example.test/callback",
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    });
    expect(burnedRedirect.status).toBe(400);

    const freshVerifier = crypto.randomBytes(32).toString("base64url");
    const freshChallenge = crypto.createHash("sha256").update(freshVerifier).digest("base64url");
    const second = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: freshChallenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    const badPkce = await request(app).post("/api/oauth/token").send({
      grant_type: "authorization_code",
      code: second.body.code,
      redirect_uri: "https://hooks.example.test/callback",
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: crypto.randomBytes(32).toString("base64url"),
    });
    expect(badPkce.status).toBe(400);

    const thirdVerifier = crypto.randomBytes(32).toString("base64url");
    const thirdChallenge = crypto.createHash("sha256").update(thirdVerifier).digest("base64url");
    const third = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: thirdChallenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    const exchange = () =>
      request(app).post("/api/oauth/token").send({
        grant_type: "authorization_code",
        code: third.body.code,
        redirect_uri: "https://hooks.example.test/callback",
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: thirdVerifier,
      });
    const [firstRace, secondRace] = await Promise.all([exchange(), exchange()]);
    const successes = [firstRace, secondRace].filter((res) => res.status === 200);
    expect(successes).toHaveLength(1);

    const refreshed = await request(app).post("/api/oauth/token").send({
      grant_type: "refresh_token",
      refresh_token: successes[0].body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refresh_token).not.toBe(successes[0].body.refresh_token);

    const replay = await request(app).post("/api/oauth/token").send({
      grant_type: "refresh_token",
      refresh_token: successes[0].body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(replay.status).toBe(400);

    const killed = await request(app).post("/api/oauth/token").send({
      grant_type: "refresh_token",
      refresh_token: refreshed.body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
    expect(killed.status).toBe(400);

    const rejected = await request(app)
      .post(`/api/admin/apps/${registered.body.data.id}/review`)
      .set("Authorization", sessionFor(admin))
      .send({ reviewStatus: "rejected" });
    expect(rejected.status).toBe(200);

    const fourthVerifier = crypto.randomBytes(32).toString("base64url");
    const fourthChallenge = crypto.createHash("sha256").update(fourthVerifier).digest("base64url");
    const afterReject = await request(app)
      .post("/api/oauth/authorize")
      .set("Authorization", sessionFor(owner))
      .send({
        client_id: clientId,
        redirect_uri: "https://hooks.example.test/callback",
        scope: "sites:read",
        code_challenge: fourthChallenge,
        code_challenge_method: "S256",
        site_id: site._id.toString(),
      });
    expect(afterReject.status).toBe(400);
  });
});
