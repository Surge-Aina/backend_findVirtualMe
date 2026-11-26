const express = require("express");
const request = require("supertest");
const Portfolio = require("../models/Portfolio");
const PortfolioDraft = require("../models/PortfolioDraft");
const ComponentAudit = require("../models/ComponentAudit");
const ContactMeForm = require("../../contact/contactMeForm.model");
const User = require("../../../shared/models/User");
const { createKey } = require("../../public-api/apiKey.service");
const { mountPublicApi } = require("../../public-api/mount");
const contactRoutes = require("../../contact/contactMeForm.routes");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = { _id: TEST_USER_ID, id: TEST_USER_ID, email: "owner@example.com" };
  next();
});

jest.mock("../../../shared/services/s3Service", () => ({
  deleteManyByPrefix: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }))
);

const portfolioRoutes = require("../portfolio.routes");

const ownerApp = express();
ownerApp.use(express.json());
ownerApp.use("/api/portfolios", portfolioRoutes);

const publicApp = express();
publicApp.use(express.json());
mountPublicApi(publicApp);
publicApp.use("/api/contact", contactRoutes);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

async function createOwnerPortfolio(overrides = {}) {
  return Portfolio.create({
    owner: TEST_USER_ID,
    template: "healthcare",
    title: "Components Clinic",
    visibility: "public",
    slug: `comp-${nonce()}`,
    sections: [{ type: "hero", order: 0, data: { headline: "Welcome" } }],
    ...overrides,
  });
}

describe("Feature components (Puck registry)", () => {
  const originalComponents = process.env.FEATURE_COMPONENTS_ENABLED;
  const originalDrafts = process.env.SITE_DRAFTS_ENABLED;

  afterAll(() => {
    if (originalComponents === undefined) delete process.env.FEATURE_COMPONENTS_ENABLED;
    else process.env.FEATURE_COMPONENTS_ENABLED = originalComponents;
    if (originalDrafts === undefined) delete process.env.SITE_DRAFTS_ENABLED;
    else process.env.SITE_DRAFTS_ENABLED = originalDrafts;
  });

  describe("FEATURE_COMPONENTS_ENABLED=false", () => {
    beforeEach(() => {
      process.env.FEATURE_COMPONENTS_ENABLED = "false";
      process.env.SITE_DRAFTS_ENABLED = "false";
    });

    it("hides owner components route", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_COMPONENTS_DISABLED");
    });
  });

  describe("with flags on", () => {
    beforeEach(async () => {
      process.env.FEATURE_COMPONENTS_ENABLED = "true";
      process.env.SITE_DRAFTS_ENABLED = "true";
      await User.findOneAndUpdate(
        { _id: TEST_USER_ID },
        {
          username: `comp_owner_${nonce()}`,
          email: `comp.owner.${nonce()}@example.test`,
          password: "synthetic-password",
          userKey: `uk_${nonce()}`,
          practiceId: `pid_${nonce()}`,
          role: "customer",
        },
        { upsert: true, new: true }
      );
    });

    it("returns Puck-shaped config and data mapping for owner", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.status).toBe(200);
      expect(res.body.config.root).toBeDefined();
      expect(res.body.config.components.ContactLeadForm).toMatchObject({
        label: expect.any(String),
        fields: expect.any(Object),
        defaultProps: expect.any(Object),
      });
      expect(res.body.reference).toMatchObject({
        name: "Puck",
        license: "MIT",
        url: expect.stringContaining("puckeditor/puck"),
      });
      expect(res.body.dataMapping).toBeDefined();
      expect(res.body.data).toMatchObject({
        content: expect.any(Array),
        root: { props: expect.any(Object) },
        zones: {},
      });
    });

    it("validates Puck props on public API writes without touching live site", async () => {
      const site = await createOwnerPortfolio({ title: "Live Title" });
      const readKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:read"],
        name: "Read",
      });
      const denied = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${readKey.secret}`)
        .send({ type: "Gallery", props: { title: "Pics" } });
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe("insufficient_scope");

      const writeKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:write"],
        name: "Write",
      });

      const bad = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ type: "Gallery", props: { title: "Pics", unknownField: true } });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("invalid_component_config");

      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Gallery",
          props: { title: "Our work", images: [{ url: "https://cdn.example/a.jpg", caption: "A" }] },
        });
      expect(added.status).toBe(201);
      expect(added.body.data.source).toBe("api");
      expect(added.body.data.approvalState).toBe("pending_owner");

      const live = await Portfolio.findById(site._id).lean();
      expect(live.sections.some((s) => s.type === "gallery")).toBe(false);

      const draft = await PortfolioDraft.findOne({ portfolioId: site._id }).lean();
      expect(draft.source).toBe("api");
      expect(draft.sections.some((s) => s.type === "gallery")).toBe(true);
      expect(draft.sections.find((s) => s.type === "gallery").data.title).toBe("Our work");

      const audits = await ComponentAudit.find({ portfolioId: site._id }).lean();
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(audits)).not.toMatch(/example@test/);
    });

    it("denies cross-site public API writes", async () => {
      const foreign = await Portfolio.create({
        owner: OTHER_USER_ID,
        template: "agent",
        title: "Foreign",
        slug: `foreign-${nonce()}`,
        sections: [],
      });
      await User.create({
        _id: OTHER_USER_ID,
        username: `other_${nonce()}`,
        email: `other.${nonce()}@example.test`,
        password: "synthetic-password",
        userKey: `uk_o_${nonce()}`,
        practiceId: `pid_o_${nonce()}`,
        role: "customer",
      });

      const writeKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:write"],
        name: "Write",
      });

      const res = await request(publicApp)
        .post(`/api/public/v1/sites/${foreign._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ type: "Services", props: { title: "Nope" } });
      expect(res.status).toBe(404);
    });

    it("routes contact form submission through leads pipeline", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(publicApp).post("/api/contact").send({
        name: "Pat Visitor",
        email: "pat.visitor@example.test",
        message: "Hello from component slice",
        portfolioId: site._id.toString(),
        ownerEmail: "owner@example.com",
        ownerName: "Owner",
      });
      expect(res.status).toBe(201);
      const stored = await ContactMeForm.findOne({ portfolioId: site._id }).lean();
      expect(stored).toBeTruthy();
      expect(stored.email).toBe("pat.visitor@example.test");
    });
  });
});