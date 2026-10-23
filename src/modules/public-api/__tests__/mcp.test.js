const express = require("express");
const request = require("supertest");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const ContactMeForm = require("../../contact/contactMeForm.model");
const { createKey } = require("../apiKey.service");
const { mountMcp } = require("../mcp");

const app = express();
app.use(express.json());
mountMcp(app);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function createUser() {
  const id = nonce();
  return User.create({
    username: `mcp_${id}`,
    email: `mcp.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
  });
}

describe("MCP server", () => {
  it("rejects a missing key and lists sites for a scoped key", async () => {
    const missing = await request(app).post("/api/mcp").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(missing.status).toBe(401);

    const user = await createUser();
    await Portfolio.create({
      owner: user._id,
      slug: `mcp${nonce()}`,
      title: "MCP Clinic",
      template: "healthcare",
      visibility: "public",
    });
    const key = await createKey({ userId: user._id, scopes: ["sites:read"], name: "MCP" });

    const listed = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${key.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
    expect(listed.status).toBe(200);
    const body = typeof listed.body === "string" ? JSON.parse(listed.body) : listed.body;
    const text = JSON.stringify(body);
    expect(text).toContain("list_sites");
    expect(text).toContain("get_business_profile");
    expect(text).toContain("get_lead");
    expect(text).toContain("list_webhooks");
    expect(text).not.toContain("list_leads");
    expect(text).not.toContain(key.secret);
  });

  it("reads an owned lead and rejects a key without leads:read", async () => {
    const user = await createUser();
    const site = await Portfolio.create({
      owner: user._id,
      slug: `lead${nonce()}`,
      title: "Lead Clinic",
      template: "healthcare",
      visibility: "public",
    });
    const submittedEmail = "Visitor@Example.TEST";
    const lead = await ContactMeForm.create({
      portfolioId: site._id,
      ownerEmail: "owner@example.test",
      ownerName: "Owner Example",
      name: "Visitor Example",
      email: submittedEmail,
      message: "Hello",
      consentContact: true,
    });
    const key = await createKey({ userId: user._id, scopes: ["leads:read"], name: "Leads" });
    const found = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${key.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_lead", arguments: { leadId: lead._id.toString() } },
      });
    expect(found.status).toBe(200);
    const body = JSON.stringify(found.body);
    expect(body).toContain(submittedEmail);
    expect(body).toContain(lead._id.toString());
    expect(body).not.toContain("owner@example.test");
    expect(body).not.toContain(key.secret);

    const sitesOnly = await createKey({ userId: user._id, scopes: ["sites:read"], name: "Sites" });
    const denied = await request(app)
      .post("/api/mcp")
      .set("Authorization", `Bearer ${sitesOnly.secret}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_lead", arguments: { leadId: lead._id.toString() } },
      });
    expect(denied.status).toBe(200);
    expect(JSON.stringify(denied.body)).toContain("insufficient_scope");
    expect(JSON.stringify(denied.body)).not.toContain(submittedEmail);
  });
});
