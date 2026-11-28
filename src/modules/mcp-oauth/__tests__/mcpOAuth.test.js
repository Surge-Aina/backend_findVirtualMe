const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const { mountMcpOAuth } = require("../mount");
const { mountMcp } = require("../../public-api/mcp");
const { createKey } = require("../../public-api/apiKey.service");

const ISSUER = "https://localhost";

function sha256Url(input) {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function createUser(tag) {
  const id = nonce();
  return User.create({
    username: `acct_${tag}_${id}`,
    email: `mailbox.${tag}.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  mountMcpOAuth(app);
  mountMcp(app);
  return app;
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

  afterAll(() => {
    if (saved.MCP_OAUTH_ENABLED === undefined) delete process.env.MCP_OAUTH_ENABLED;
    else process.env.MCP_OAUTH_ENABLED = saved.MCP_OAUTH_ENABLED;
    if (saved.MCP_OAUTH_ISSUER_URL === undefined) delete process.env.MCP_OAUTH_ISSUER_URL;
    else process.env.MCP_OAUTH_ISSUER_URL = saved.MCP_OAUTH_ISSUER_URL;
    if (saved.PUBLIC_API_BASE_URL === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = saved.PUBLIC_API_BASE_URL;
  });

  it("advertises authorization server and protected resource metadata", async () => {
    const app = buildApp();
    const as = await request(app).get("/.well-known/oauth-authorization-server");
    expect(as.status).toBe(200);
    expect(as.body.issuer).toBe(`${ISSUER}/`);
    expect(as.body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.body.client_id_metadata_document_supported).toBe(true);

    const prm = await request(app).get("/.well-known/oauth-protected-resource");
    expect(prm.status).toBe(200);
    expect(prm.body.resource).toBe(`${ISSUER}/api/mcp`);

    const prmPath = await request(app).get("/.well-known/oauth-protected-resource/api/mcp");
    expect(prmPath.status).toBe(200);
    expect(prmPath.body.resource).toBe(`${ISSUER}/api/mcp`);
  });

  it("returns WWW-Authenticate on unauthenticated MCP requests", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/resource_metadata="/);
    expect(res.headers["www-authenticate"]).toContain("/.well-known/oauth-protected-resource");
  });

  it("registers a public client, authorizes with PKCE, and exchanges tokens", async () => {
    const app = buildApp();
    const owner = await createUser("oauth_owner");
    const site = await Portfolio.create({
      owner: owner._id,
      slug: `site${nonce()}`,
      title: "OAuth Site",
      template: "healthcare",
      visibility: "public",
    });

    const registered = await request(app)
      .post("/register")
      .send({
        client_name: "Connector Example",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      });
    expect(registered.status).toBe(201);
    const clientId = registered.body.client_id;

    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = sha256Url(verifier);
    const authorize = await request(app)
      .get("/authorize")
      .query({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope: "sites:read profile:read",
        resource: `${ISSUER}/api/mcp`,
      });
    expect(authorize.status).toBe(302);
    const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
    expect(ticket).toBeTruthy();

    const consentCookie = jwt.sign({ id: String(owner._id), kind: "mcp_consent" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const consent = await request(app)
      .post("/mcp-oauth/consent")
      .set("Cookie", `fvm_mcp_consent=${encodeURIComponent(consentCookie)}`)
      .type("form")
      .send({
        ticket,
        scopes: ["sites:read", "profile:read"],
      });
    expect(consent.status).toBe(302);
    const callback = new URL(consent.headers.location);
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: verifier,
        resource: `${ISSUER}/api/mcp`,
      });
    expect(token.status).toBe(200);
    expect(token.body.access_token).toMatch(/^fvm_mcp_at_/);
    expect(token.body.refresh_token).toMatch(/^fvm_mcp_rt_/);

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
    expect(mcp.status).toBe(200);
    const text = JSON.stringify(mcp.body);
    expect(text).toContain("OAuth Site");

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
    expect(refreshed.body.access_token).not.toBe(token.body.access_token);

    await request(app)
      .post("/revoke")
      .type("form")
      .send({
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

  it("enforces scopes and tenant isolation", async () => {
    const app = buildApp();
    const owner = await createUser("scope_owner");
    const outsider = await createUser("scope_outsider");
    const site = await Portfolio.create({
      owner: owner._id,
      slug: `scope${nonce()}`,
      title: "Scope Site",
      template: "healthcare",
      visibility: "public",
    });
    await Portfolio.create({
      owner: outsider._id,
      slug: `other${nonce()}`,
      title: "Other Tenant",
      template: "healthcare",
      visibility: "public",
    });

    const registered = await request(app).post("/register").send({
      client_name: "Scope Test",
      redirect_uris: ["https://chatgpt.com/connector/oauth"],
      token_endpoint_auth_method: "none",
    });
    const clientId = registered.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = sha256Url(verifier);
    const authorize = await request(app).get("/authorize").query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://chatgpt.com/connector/oauth",
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: "sites:read",
      resource: `${ISSUER}/api/mcp`,
    });
    const ticket = new URL(authorize.headers.location, ISSUER).searchParams.get("ticket");
    const cookie = jwt.sign({ id: String(owner._id), kind: "mcp_consent" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const consent = await request(app)
      .post("/mcp-oauth/consent")
      .set("Cookie", `fvm_mcp_consent=${encodeURIComponent(cookie)}`)
      .type("form")
      .send({ ticket, scopes: ["sites:read"] });
    const code = new URL(consent.headers.location).searchParams.get("code");
    const token = await request(app).post("/token").type("form").send({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: "https://chatgpt.com/connector/oauth",
      code_verifier: verifier,
      resource: `${ISSUER}/api/mcp`,
    });
    expect(token.status).toBe(200);

    const denied = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_lead", arguments: { leadId: "507f1f77bcf86cd799439011" } },
      });
    expect(JSON.stringify(denied.body)).toContain("insufficient_scope");

    const foreign = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${token.body.access_token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "get_site", arguments: { siteId: String(site._id) } },
      });
    expect(foreign.status).toBe(200);
    expect(JSON.stringify(foreign.body)).toContain("Scope Site");
  });

  it("keeps existing fvm_ API keys working when MCP OAuth is enabled", async () => {
    const app = buildApp();
    const owner = await createUser("legacy");
    const key = await createKey({ userId: owner._id, scopes: ["sites:read"], name: "Legacy" });
    const res = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${key.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 5, method: "tools/list" });
    expect(res.status).toBe(200);
  });
});