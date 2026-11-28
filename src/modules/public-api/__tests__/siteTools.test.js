const express = require("express");
const request = require("supertest");

jest.mock("../../payments/subscription-access.service", () => ({
  getActiveSubscriptionForUser: jest.fn().mockResolvedValue(null),
}));
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const PortfolioVersion = require("../../portfolios/models/PortfolioVersion");
const { createKey } = require("../apiKey.service");
const { mountPublicApi } = require("../mount");
const { mountMcp } = require("../mcp");
const { resetPublicApiRateLimits } = require("../rateLimit");

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

    const content = await request(app)
      .get(`/api/public/v1/sites/${siteId}/content`)
      .set("Authorization", `Bearer ${key.secret}`);
    expect(content.body.data.content.about).toBe("Before revert");
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