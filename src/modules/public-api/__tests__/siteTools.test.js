const express = require("express");
const request = require("supertest");

jest.mock("../../payments/subscription-access.service", () => ({
  getActiveSubscriptionForUser: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../marketplace/oauth.service", () => ({
  authenticateAccessToken: jest.fn(),
}));
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const PortfolioVersion = require("../../portfolios/models/PortfolioVersion");
const { createKey } = require("../apiKey.service");
const { mountPublicApi } = require("../mount");
const { mountMcp } = require("../mcp");
const { resetPublicApiRateLimits } = require("../rateLimit");
const { authenticateAccessToken } = require("../../marketplace/oauth.service");

const app = express();
app.use(express.json());
mountPublicApi(app);
mountMcp(app);

const originalTools = process.env.MCP_SITE_TOOLS_ENABLED;
const originalDrafts = process.env.SITE_DRAFTS_ENABLED;

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function createUser() {
  const id = nonce();
  return User.create({
    username: `site_tools_${id}`,
    email: `site.tools.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
    name: "Site Tools Example",
  });
}

describe("site tools (public API + MCP)", () => {
  beforeEach(() => {
    resetPublicApiRateLimits();
    process.env.MCP_SITE_TOOLS_ENABLED = "true";
    delete process.env.SITE_DRAFTS_ENABLED;
    authenticateAccessToken.mockReset();
  });

  afterAll(() => {
    if (originalTools === undefined) delete process.env.MCP_SITE_TOOLS_ENABLED;
    else process.env.MCP_SITE_TOOLS_ENABLED = originalTools;
    if (originalDrafts === undefined) delete process.env.SITE_DRAFTS_ENABLED;
    else process.env.SITE_DRAFTS_ENABLED = originalDrafts;
  });

  it("hides routes when MCP_SITE_TOOLS_ENABLED is off", async () => {
    process.env.MCP_SITE_TOOLS_ENABLED = "false";
    const user = await createUser();
    const key = await createKey({ userId: user._id, scopes: ["sites:write"], name: "Off" });
    const res = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "agent", title: "Hidden" });
    expect(res.status).toBe(404);
  });

  it("creates a site, reads and updates projectManager content", async () => {
    const user = await createUser();
    const key = await createKey({
      userId: user._id,
      scopes: ["sites:read", "sites:write"],
      name: "Builder",
    });

    const created = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "projectManager", title: "PM Example" });
    expect(created.status).toBe(201);
    const siteId = created.body.data.id;

    const content = await request(app)
      .get(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`);
    expect(content.status).toBe(200);
    expect(content.body.data.template).toBe("projectManager");

    const updated = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({
        content: {
          summary: { name: "Alex Example", title: "Program Manager" },
          skills: { items: ["Planning", "Delivery"] },
        },
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.content.summary.name).toBe("Alex Example");

    const settings = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/settings`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ settings: { slug: `pm-${nonce()}`, visibility: "private" } });
    expect(settings.status).toBe(200);
    expect(settings.body.data.slug).toMatch(/^pm-/);
  });

  it("registers MCP site tools when enabled", async () => {
    const user = await createUser();
    const key = await createKey({ userId: user._id, scopes: ["sites:read", "sites:write"], name: "MCP" });
    const listed = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${key.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    expect(listed.status).toBe(200);
    const text = JSON.stringify(listed.body);
    expect(text).toContain("create_site");
    expect(text).toContain("get_site_content");
    expect(text).toContain("publish_site");
    expect(text).toContain("list_versions");
    expect(text).toContain("revert_version");
  });

  it("returns 405 for GET /api/mcp", async () => {
    const res = await request(app).get("/api/mcp");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("returns PLAN_LIMIT when a free account creates a second site", async () => {
    const user = await createUser();
    const key = await createKey({ userId: user._id, scopes: ["sites:write"], name: "Cap" });
    const first = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "agent", title: "Only One" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "agent", title: "Too Many" });
    expect(second.status).toBe(402);
    expect(second.body.error.code).toBe("PLAN_LIMIT");
  });

  it("records versions on MCP content writes and supports revert", async () => {
    process.env.SITE_DRAFTS_ENABLED = "true";
    const user = await createUser();
    const key = await createKey({
      userId: user._id,
      scopes: ["sites:read", "sites:write"],
      name: "Versions",
    });
    const created = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "agent", title: "Versioned" });
    const siteId = created.body.data.id;

    const mcpHeaders = {
      Authorization: `Bearer ${key.secret}`,
      Accept: "application/json, text/event-stream",
    };

    const firstWrite = await request(app)
      .post("/api/mcp")
      .set(mcpHeaders)
      .send({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "update_site_content",
          arguments: { siteId, content: { about: "Before revert" } },
        },
      });
    expect(firstWrite.status).toBe(200);
    expect(JSON.stringify(firstWrite.body)).toContain("versionNumber");

    const secondWrite = await request(app)
      .post("/api/mcp")
      .set(mcpHeaders)
      .send({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "update_site_content",
          arguments: { siteId, content: { about: "After first version" } },
        },
      });
    expect(secondWrite.status).toBe(200);

    const listed = await request(app)
      .post("/api/mcp")
      .set(mcpHeaders)
      .send({
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: { name: "list_versions", arguments: { siteId } },
      });
    expect(listed.status).toBe(200);
    const listText = JSON.stringify(listed.body);
    expect(listText).toContain("versionNumber");

    const versions = await PortfolioVersion.find({ portfolioId: siteId }).sort({ versionNumber: -1 });
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const beforeRevertVersions = await PortfolioVersion.countDocuments({ portfolioId: siteId });

    const revert = await request(app)
      .post("/api/mcp")
      .set(mcpHeaders)
      .send({
        jsonrpc: "2.0",
        id: 13,
        method: "tools/call",
        params: { name: "revert_version", arguments: { siteId, versionNumber: 1 } },
      });
    expect(revert.status).toBe(200);
    expect(JSON.stringify(revert.body)).toContain("revertedFromVersion");
    expect(JSON.stringify(revert.body)).toContain("versionNumber");

    const afterRevertVersions = await PortfolioVersion.countDocuments({ portfolioId: siteId });
    expect(afterRevertVersions).toBeGreaterThan(beforeRevertVersions);

    const content = await request(app)
      .get(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`);
    expect(content.body.data.content.about).toBe("Before revert");
  });

  it("rejects create_site for site-pinned OAuth tokens", async () => {
    const user = await createUser();
    const pinned = await Portfolio.create({
      owner: user._id,
      slug: `pin-${nonce()}`,
      title: "Pinned",
      template: "agent",
      visibility: "private",
    });
    authenticateAccessToken.mockResolvedValue({
      user,
      scopes: ["sites:read", "sites:write"],
      installation: { _id: pinned._id, appId: "app_test", siteId: pinned._id },
    });

    const httpRes = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", "Bearer fvm_at_pinned_test")
      .send({ template: "agent", title: "Blocked" });
    expect(httpRes.status).toBe(403);
    expect(httpRes.body.error.code).toBe("forbidden");

    const mcpRes = await request(app)
      .post("/api/mcp")
      .set("Authorization", "Bearer fvm_at_pinned_test")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 90,
        method: "tools/call",
        params: { name: "create_site", arguments: { template: "agent" } },
      });
    expect(mcpRes.status).toBe(200);
    expect(JSON.stringify(mcpRes.body)).toMatch(/forbidden/i);
  });

  it("rejects writes when the key only has sites:read", async () => {
    const user = await createUser();
    const key = await createKey({ userId: user._id, scopes: ["sites:read"], name: "ReadOnly" });
    const site = await Portfolio.create({
      owner: user._id,
      slug: `ro-${nonce()}`,
      title: "Read only",
      template: "agent",
      visibility: "private",
    });
    const res = await request(app)
      .patch(`/api/public/v1/sites/${site._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { about: "Nope" } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("insufficient_scope");
  });

  it("returns conflict when slug is taken by another user", async () => {
    const owner = await createUser();
    const other = await createUser();
    const takenSlug = `slug-${nonce()}`;
    await Portfolio.create({
      owner: other._id,
      slug: takenSlug,
      title: "Other",
      template: "projectManager",
      visibility: "private",
    });
    const key = await createKey({
      userId: owner._id,
      scopes: ["sites:read", "sites:write"],
      name: "Slug",
    });
    const created = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "projectManager", title: "Mine" });
    const siteId = created.body.data.id;
    const res = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/settings`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ settings: { slug: takenSlug } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
  });

  it("rejects reserved slugs and unsafe content payloads", async () => {
    const user = await createUser();
    const key = await createKey({
      userId: user._id,
      scopes: ["sites:read", "sites:write"],
      name: "Validate",
    });
    const created = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "projectManager", title: "Validate" });
    const siteId = created.body.data.id;

    const reserved = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/settings`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ settings: { slug: "admin" } });
    expect(reserved.status).toBe(400);

    const badUrl = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { resumeUrl: "javascript:alert(1)" } });
    expect(badUrl.status).toBe(400);

    const updated = await request(app)
      .patch(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({
        content: {
          summary: { name: "Safe", evilField: "ignored" },
        },
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.content.summary.name).toBe("Safe");
    expect(updated.body.data.content.summary.evilField).toBeUndefined();
  });

  it("returns 404 when reverting a version on another user's site", async () => {
    process.env.SITE_DRAFTS_ENABLED = "true";
    const owner = await createUser();
    const stranger = await createUser();
    const portfolio = await Portfolio.create({
      owner: owner._id,
      slug: `rev-${nonce()}`,
      title: "Owner site",
      template: "agent",
      visibility: "private",
    });
    const ownerKey = await createKey({
      userId: owner._id,
      scopes: ["sites:read", "sites:write"],
      name: "Owner",
    });
    await request(app)
      .patch(`/api/public/v1/sites/${portfolio._id}/content`)
      .set("Authorization", `Bearer ${ownerKey.secret}`)
      .send({ content: { about: "Version body" } });

    const strangerKey = await createKey({
      userId: stranger._id,
      scopes: ["sites:read", "sites:write"],
      name: "Stranger",
    });
    const mcpRes = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${strangerKey.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 77,
        method: "tools/call",
        params: {
          name: "revert_version",
          arguments: { siteId: portfolio._id, versionNumber: 1 },
        },
      });
    expect(mcpRes.status).toBe(200);
    expect(JSON.stringify(mcpRes.body)).toMatch(/not_found/i);
  });

  it("allows read and edit but blocks create when a free user already owns multiple sites", async () => {
    const user = await createUser();
    const key = await createKey({
      userId: user._id,
      scopes: ["sites:read", "sites:write"],
      name: "OverLimit",
    });
    await Portfolio.create({
      owner: user._id,
      slug: `legacy-a-${nonce()}`,
      title: "Legacy A",
      template: "agent",
      visibility: "private",
    });
    const site = await Portfolio.create({
      owner: user._id,
      slug: `legacy-b-${nonce()}`,
      title: "Legacy B",
      template: "projectManager",
      visibility: "private",
      sections: [
        { type: "summary", order: 0, data: { name: "Legacy", bio: "" } },
        { type: "skills", order: 1, data: { items: [] } },
        { type: "experience", order: 2, data: { items: [] } },
        { type: "education", order: 3, data: { items: [] } },
        { type: "projects", order: 4, data: { items: [] } },
        { type: "contact", order: 5, data: {} },
      ],
    });

    const read = await request(app)
      .get(`/api/public/v1/sites/${site._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`);
    expect(read.status).toBe(200);

    const edit = await request(app)
      .patch(`/api/public/v1/sites/${site._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { about: "Still editable" } });
    expect(edit.status).toBe(200);

    const create = await request(app)
      .post("/api/public/v1/sites")
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ template: "agent", title: "Third" });
    expect(create.status).toBe(402);
    expect(create.body.error.code).toBe("PLAN_LIMIT");
  });

  it("cannot read another account's site content", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const portfolio = await Portfolio.create({
      owner: owner._id,
      slug: `foreign-${nonce()}`,
      title: "Foreign",
      template: "agent",
      visibility: "private",
    });
    const key = await createKey({ userId: stranger._id, scopes: ["sites:read"], name: "X" });
    const res = await request(app)
      .get(`/api/public/v1/sites/${portfolio._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`);
    expect(res.status).toBe(404);
  });
});