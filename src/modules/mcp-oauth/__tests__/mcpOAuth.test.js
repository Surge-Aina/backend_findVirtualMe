const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const McpOAuthPending = require("../models/mcpOAuthPending.model");
const McpOAuthCode = require("../models/mcpOAuthCode.model");
const { mountMcpOAuth, getProvider } = require("../mount");
const { mountMcp } = require("../../public-api/mcp");
const { createKey } = require("../../public-api/apiKey.service");
const { renderDocsPage } = require("../../public-api/docsPage");
const { publicApiBaseUrl } = require("../../../shared/config/mcpOAuth");
const { CONSENT_COOKIE, consentJwtSecret, CONSENT_JWT_AUDIENCE } = require("../consentCookie");
const { resetConsentThrottles } = require("../consentThrottle");
const auth = require("../../../shared/middleware/auth");
const { hashKey } = require("../../public-api/apiKey.service");

const ISSUER = "https://localhost";

function sha256Url(input) {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function createUser(tag, { authProvider = "local", googleId, password = "synthetic-password" } = {}) {
  const id = nonce();
  const hashed = authProvider === "local" ? await bcrypt.hash(password, 4) : undefined;
  return User.create({
    username: `acct_${tag}_${id}`,
    email: `mailbox.${tag}.${id}@example.test`,
    password: hashed,
    authProvider,
    googleId,
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
  });
}

function consentSession(userId) {
  const token = jwt.sign(
    { sub: String(userId), kind: "mcp_consent" },
    consentJwtSecret(),
    { expiresIn: "1h", audience: CONSENT_JWT_AUDIENCE }
  );
  return `${CONSENT_COOKIE}=${encodeURIComponent(token)}`;
}

function buildApp({ oauthEnabled = true } = {}) {
  if (oauthEnabled) process.env.MCP_OAUTH_ENABLED = "true";
  else delete process.env.MCP_OAUTH_ENABLED;
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  getProvider();
  mountMcpOAuth(app);
  mountMcp(app);
  return app;
}

async function registerClient(app, redirectUri = "https://claude.ai/api/mcp/auth_callback") {
  const res = await request(app)
    .post("/register")
    .send({
      client_name: "Connector Example",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  return res;
}

async function authorizeAndConsent(app, { clientId, redirectUri, owner, scopes }) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = sha256Url(verifier);
  const authorize = await request(app).get("/authorize").query({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: scopes.join(" "),
    resource: `${ISSUER}/api/mcp`,
  });
  const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
  const pending = await McpOAuthPending.findOne({ ticket }).lean();
  const consent = await request(app)
    .post("/mcp-oauth/consent")
    .set("Cookie", consentSession(owner._id))
    .type("form")
    .send({ ticket, csrf: pending.csrfToken, scopes });
  const code = new URL(consent.headers.location).searchParams.get("code");
  return { verifier, code, challenge };
}

describe("MCP OAuth 2.1", () => {
  const saved = {};

  beforeAll(() => {
    saved.MCP_OAUTH_ENABLED = process.env.MCP_OAUTH_ENABLED;
    saved.MCP_OAUTH_ISSUER_URL = process.env.MCP_OAUTH_ISSUER_URL;
    saved.PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL;
    process.env.MCP_OAUTH_ENABLED = "true";
    process.env.MCP_OAUTH_ISSUER_URL = ISSUER;
    process.env.PUBLIC_API_BASE_URL = ISSUER;
    process.env.MCP_OAUTH_ACCESS_TTL_SECONDS = "3600";
    process.env.MCP_OAUTH_REFRESH_TTL_SECONDS = "86400";
  });

  beforeEach(() => {
    process.env.MCP_OAUTH_ENABLED = "true";
    process.env.MCP_OAUTH_ISSUER_URL = ISSUER;
    process.env.PUBLIC_API_BASE_URL = ISSUER;
    resetConsentThrottles();
  });

  afterAll(() => {
    if (saved.MCP_OAUTH_ENABLED === undefined) delete process.env.MCP_OAUTH_ENABLED;
    else process.env.MCP_OAUTH_ENABLED = saved.MCP_OAUTH_ENABLED;
    if (saved.MCP_OAUTH_ISSUER_URL === undefined) delete process.env.MCP_OAUTH_ISSUER_URL;
    else process.env.MCP_OAUTH_ISSUER_URL = saved.MCP_OAUTH_ISSUER_URL;
    if (saved.PUBLIC_API_BASE_URL === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = saved.PUBLIC_API_BASE_URL;
  });

  it("uses the production backend base URL in docs when env is unset", () => {
    const savedBase = process.env.PUBLIC_API_BASE_URL;
    const savedIssuer = process.env.MCP_OAUTH_ISSUER_URL;
    delete process.env.PUBLIC_API_BASE_URL;
    delete process.env.MCP_OAUTH_ISSUER_URL;
  try {
    const base = publicApiBaseUrl();
    expect(base).toBe("https://backend-production-6b312c6c.up.railway.app");
    expect(renderDocsPage()).toContain(`${base}/api/mcp`);
  } finally {
    if (savedBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = savedBase;
    if (savedIssuer === undefined) delete process.env.MCP_OAUTH_ISSUER_URL;
    else process.env.MCP_OAUTH_ISSUER_URL = savedIssuer;
  }
  });

  it("advertises authorization server and protected resource metadata", async () => {
    const app = buildApp();
    const as = await request(app).get("/.well-known/oauth-authorization-server");
    expect(as.status).toBe(200);
    expect(as.body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.body.client_id_metadata_document_supported).toBe(true);
    const prm = await request(app).get("/.well-known/oauth-protected-resource");
    expect(prm.status).toBe(200);
    expect(prm.body.resource).toBe(`${ISSUER}/api/mcp`);
  });

  it("registers, authorizes with PKCE S256, exchanges, refreshes, and revokes", async () => {
    const app = buildApp();
    const owner = await createUser("oauth_owner");
    const site = await Portfolio.create({
      owner: owner._id,
      slug: `site${nonce()}`,
      title: "OAuth Site",
      template: "healthcare",
      visibility: "public",
    });
    const registered = await registerClient(app);
    expect(registered.status).toBe(201);
    const clientId = registered.body.client_id;
    const { verifier, code } = await authorizeAndConsent(app, {
      clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner,
      scopes: ["sites:read", "profile:read"],
    });
    const token = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(token.status).toBe(200);
    expect(token.body.access_token).toMatch(/^fvm_mcp_at_/);

    const mcp = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_site", arguments: { siteId: String(site._id) } },
      });
    expect(JSON.stringify(mcp.body)).toContain("OAuth Site");

    const refreshed = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: token.body.refresh_token,
        resource: `${ISSUER}/api/mcp`,
      });
    expect(refreshed.status).toBe(200);

    await request(app).post("/revoke").type("form").send({
      client_id: clientId,
      token: refreshed.body.access_token,
    });
    const blocked = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${refreshed.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(blocked.status).toBe(401);
  });

  it("returns invalid_grant for wrong PKCE verifier", async () => {
    const app = buildApp();
    const owner = await createUser("pkce_owner");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const { code } = await authorizeAndConsent(app, {
      clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner,
      scopes: ["sites:read"],
    });
    const bad = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: crypto.randomBytes(32).toString("base64url"),
      resource: `${ISSUER}/api/mcp`,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_grant");
  });

  it("rejects code replay and revokes the token family", async () => {
    const app = buildApp();
    const owner = await createUser("replay_code");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const { verifier, code } = await authorizeAndConsent(app, {
      clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner,
      scopes: ["sites:read"],
    });
    const first = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(first.status).toBe(200);
    const replay = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe("invalid_grant");
    const blocked = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${first.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(blocked.status).toBe(401);
  });

  it("returns invalid_grant for expired authorization codes", async () => {
    const app = buildApp();
    const owner = await createUser("expired_code");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const code = `fvm_mcp_code_${crypto.randomBytes(16).toString("base64url")}`;
    await McpOAuthCode.create({
      codeHash: hashKey(code),
      clientId,
      userId: owner._id,
      scopes: ["sites:read"],
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeChallenge: sha256Url(verifier),
      resource: `${ISSUER}/api/mcp`,
      tokenFamilyId: crypto.randomBytes(8).toString("hex"),
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toBe("invalid_grant");
  });

  it("rejects refresh token reuse and revokes the family", async () => {
    const app = buildApp();
    const owner = await createUser("refresh_reuse");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const { verifier, code } = await authorizeAndConsent(app, {
      clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner,
      scopes: ["sites:read"],
    });
    const token = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    const firstRefresh = await request(app).post("/token").type("form").send({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: token.body.refresh_token,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(firstRefresh.status).toBe(200);
    const reuse = await request(app).post("/token").type("form").send({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: token.body.refresh_token,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe("invalid_grant");
    const blocked = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${firstRefresh.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(blocked.status).toBe(401);
  });

  it("rejects bad registration redirect URIs with invalid_redirect_uri", async () => {
    const app = buildApp();
    const bad = await request(app).post("/register").send({
      client_name: "Bad",
      redirect_uris: ["https://untrusted.example.test/callback"],
      token_endpoint_auth_method: "none",
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_redirect_uri");
  });

  it("blocks consent posts with invalid CSRF", async () => {
    const app = buildApp();
    const owner = await createUser("csrf");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorize = await request(app).get("/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_challenge: sha256Url(verifier),
      code_challenge_method: "S256",
      resource: `${ISSUER}/api/mcp`,
    });
    const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
    const denied = await request(app)
      .post("/mcp-oauth/consent")
      .set("Cookie", consentSession(owner._id))
      .type("form")
      .send({ ticket, csrf: "wrong-token", scopes: ["sites:read"] });
    expect(denied.status).toBe(403);
  });

  it("throttles consent login attempts", async () => {
    const app = buildApp();
    const owner = await createUser("throttle");
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorize = await request(app).get("/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_challenge: sha256Url(verifier),
      code_challenge_method: "S256",
      resource: `${ISSUER}/api/mcp`,
    });
    const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
    const pending = await McpOAuthPending.findOne({ ticket }).lean();
    for (let i = 0; i < 8; i += 1) {
      await request(app)
        .post("/mcp-oauth/consent")
        .type("form")
        .send({
          ticket,
          csrf: pending.csrfToken,
          email: "mailbox.throttle.1@example.test",
          password: "wrong",
        });
    }
    const limited = await request(app)
      .post("/mcp-oauth/consent")
      .type("form")
      .send({
        ticket,
        csrf: pending.csrfToken,
        email: "mailbox.throttle.1@example.test",
        password: "wrong",
      });
    expect(limited.status).toBe(429);
  });

  it("guides Google accounts to web login without a 500", async () => {
    const app = buildApp();
    const googleUser = await createUser("google_user", {
      authProvider: "google",
      googleId: `gid_${nonce()}`,
    });
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorize = await request(app).get("/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_challenge: sha256Url(verifier),
      code_challenge_method: "S256",
      resource: `${ISSUER}/api/mcp`,
    });
    const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
    const pending = await McpOAuthPending.findOne({ ticket }).lean();
    const res = await request(app)
      .post("/mcp-oauth/consent")
      .type("form")
      .send({
        ticket,
        csrf: pending.csrfToken,
        email: googleUser.email,
        password: "any",
      });
    expect(res.status).toBe(401);
    expect(res.text).toContain("findvirtual.me");
  });

  it("rejects MCP OAuth tokens when the feature flag is off", async () => {
    const enabledApp = buildApp({ oauthEnabled: true });
    const owner = await createUser("flag_off");
    const registered = await registerClient(enabledApp);
    const { verifier, code } = await authorizeAndConsent(enabledApp, {
      clientId: registered.body.client_id,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner,
      scopes: ["sites:read"],
    });
    const token = await request(enabledApp).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: registered.body.client_id,
      code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    const disabledApp = buildApp({ oauthEnabled: false });
    const denied = await request(disabledApp)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe("invalid_api_key");
  });

  it("keeps fvm_ keys working when OAuth is enabled and isolates tenants", async () => {
    const app = buildApp();
    const ownerA = await createUser("tenant_a");
    const ownerB = await createUser("tenant_b");
    const siteA = await Portfolio.create({
      owner: ownerA._id,
      slug: `a${nonce()}`,
      title: "Tenant A Site",
      template: "healthcare",
      visibility: "public",
    });
    const siteB = await Portfolio.create({
      owner: ownerB._id,
      slug: `b${nonce()}`,
      title: "Tenant B Site",
      template: "healthcare",
      visibility: "public",
    });
    const registered = await registerClient(app);
    const clientId = registered.body.client_id;
    const flowB = await authorizeAndConsent(app, {
      clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      owner: ownerB,
      scopes: ["sites:read", "sites:write"],
    });
    const tokenB = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code: flowB.code,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_verifier: flowB.verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    const crossRead = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${tokenB.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "get_site", arguments: { siteId: String(siteA._id) } },
      });
    expect(JSON.stringify(crossRead.body)).toContain("not_found");

    const key = await createKey({ userId: ownerA._id, scopes: ["sites:read"], name: "Legacy" });
    const legacy = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${key.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 11, method: "tools/list" });
    expect(legacy.status).toBe(200);
    expect(JSON.stringify(crossRead.body)).not.toContain("Tenant B Site");
    expect(JSON.stringify(crossRead.body)).not.toContain(String(siteB._id));
  });

  it("rejects the MCP consent cookie on session auth middleware", async () => {
    const owner = await createUser("cookie_aud");
    const app = express();
    app.get("/protected", auth, (_req, res) => res.json({ ok: true }));
    const consentToken = jwt.sign(
      { sub: String(owner._id), kind: "mcp_consent" },
      consentJwtSecret(),
      { expiresIn: "1h", audience: CONSENT_JWT_AUDIENCE }
    );
    const denied = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${consentToken}`);
    expect(denied.status).toBe(401);
  });
});