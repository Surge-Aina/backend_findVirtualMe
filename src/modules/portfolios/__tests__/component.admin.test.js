const express = require("express");
const request = require("supertest");
const Portfolio = require("../models/Portfolio");
const User = require("../../../shared/models/User");
const { createKey } = require("../../public-api/apiKey.service");
const { mountPublicApi } = require("../../public-api/mount");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";
const ADMIN_USER_ID = "507f1f77bcf86cd799439013";

jest.mock("../../../shared/services/s3Service", () => ({
  deleteManyByPrefix: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }))
);

const publicApp = express();
publicApp.use(express.json());
mountPublicApi(publicApp);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function ensureUser(id, role) {
  return User.findOneAndUpdate(
    { _id: id },
    {
      username: `comp_${role}_${nonce()}`,
      email: `${role}.${nonce()}@example.test`,
      password: "synthetic-password",
      userKey: `uk_${nonce()}`,
      practiceId: `pid_${nonce()}`,
      role,
    },
    { upsert: true, new: true }
  );
}

async function issueWriteKey(userId) {
  return createKey({
    userId,
    scopes: ["sites:read", "sites:write"],
    name: `Write-${nonce()}`,
  });
}

describe("Admin feature component writes", () => {
  const originalComponents = process.env.FEATURE_COMPONENTS_ENABLED;
  const originalDrafts = process.env.SITE_DRAFTS_ENABLED;
  let infoSpy;

  beforeEach(async () => {
    process.env.FEATURE_COMPONENTS_ENABLED = "true";
    process.env.SITE_DRAFTS_ENABLED = "true";
    await ensureUser(TEST_USER_ID, "customer");
    await ensureUser(OTHER_USER_ID, "customer");
    await ensureUser(ADMIN_USER_ID, "admin");
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  afterAll(() => {
    if (originalComponents === undefined) delete process.env.FEATURE_COMPONENTS_ENABLED;
    else process.env.FEATURE_COMPONENTS_ENABLED = originalComponents;
    if (originalDrafts === undefined) delete process.env.SITE_DRAFTS_ENABLED;
    else process.env.SITE_DRAFTS_ENABLED = originalDrafts;
  });

  it("allows admin to add a component on another user's site", async () => {
    const otherSite = await Portfolio.create({
      owner: OTHER_USER_ID,
      template: "healthcare",
      title: "Someone else",
      visibility: "private",
      slug: `admin-comp-${nonce()}`,
      sections: [{ type: "hero", order: 0, data: { headline: "Hi" } }],
    });
    const adminKey = await issueWriteKey(ADMIN_USER_ID);

    const res = await request(publicApp)
      .post(`/api/public/v1/sites/${otherSite._id}/components`)
      .set("Authorization", `Bearer ${adminKey.secret}`)
      .send({
        type: "QrCode",
        props: { title: "Admin QR", target: "https://example.test/admin" },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.section.type).toBe("QrCode");

    const adminLog = infoSpy.mock.calls
      .map((call) => call[0])
      .find((line) => typeof line === "string" && line.includes("admin_portfolio_edit"));
    expect(adminLog).toBeDefined();
    const payload = JSON.parse(adminLog);
    expect(payload).toEqual({
      event: "admin_portfolio_edit",
      adminUserId: ADMIN_USER_ID,
      portfolioId: String(otherSite._id),
      action: "component:add",
    });
    expect(JSON.stringify(payload)).not.toMatch(/email|phone|@/i);
  });

  it("still returns not_found when a non-admin writes another user's site", async () => {
    const otherSite = await Portfolio.create({
      owner: OTHER_USER_ID,
      template: "healthcare",
      title: "Locked",
      visibility: "private",
      slug: `locked-comp-${nonce()}`,
      sections: [{ type: "hero", order: 0, data: { headline: "No" } }],
    });
    const ownerKey = await issueWriteKey(TEST_USER_ID);

    const res = await request(publicApp)
      .post(`/api/public/v1/sites/${otherSite._id}/components`)
      .set("Authorization", `Bearer ${ownerKey.secret}`)
      .send({
        type: "QrCode",
        props: { title: "Nope", target: "https://example.test/nope" },
      });

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe("not_found");
  });
});