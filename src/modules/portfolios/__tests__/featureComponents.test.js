const express = require("express");
const request = require("supertest");
const Portfolio = require("../models/Portfolio");
const PortfolioDraft = require("../models/PortfolioDraft");
const ComponentAudit = require("../models/ComponentAudit");
const ContactMeForm = require("../../contact/contactMeForm.model");
const User = require("../../../shared/models/User");
const { createKey } = require("../../public-api/apiKey.service");
const { mountPublicApi } = require("../../public-api/mount");
const { mountMcp } = require("../../public-api/mcp");
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

const mcpApp = express();
mcpApp.use(express.json());
mountMcp(mcpApp);

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

async function issueWriteKey() {
  return createKey({
    userId: TEST_USER_ID,
    scopes: ["sites:read", "sites:write"],
    name: `Write-${nonce()}`,
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
    beforeEach(async () => {
      process.env.FEATURE_COMPONENTS_ENABLED = "false";
      process.env.SITE_DRAFTS_ENABLED = "false";
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

    it("hides owner components route", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_COMPONENTS_DISABLED");
    });

    it("hides public API and MCP component surfaces", async () => {
      const site = await createOwnerPortfolio();
      const key = await createKey({ userId: TEST_USER_ID, scopes: ["sites:read"], name: "Read" });

      const pub = await request(publicApp)
        .get(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${key.secret}`);
      expect(pub.status).toBe(404);
      expect(pub.body.error.code).toBe("FEATURE_COMPONENTS_DISABLED");

      const mcp = await request(mcpApp)
        .post("/api/mcp")
        .set("Authorization", `Bearer ${key.secret}`)
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_components", arguments: { siteId: String(site._id) } },
        });
      expect(mcp.status).toBe(200);
      const body = typeof mcp.body === "string" ? JSON.parse(mcp.body) : mcp.body;
      expect(JSON.stringify(body)).toContain("FEATURE_COMPONENTS_DISABLED");
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

    it("returns Puck-shaped config and draft labels for owner", async () => {
      const site = await createOwnerPortfolio();
      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.status).toBe(200);
      expect(res.body.config.components.ContactLeadForm).toMatchObject({
        label: expect.any(String),
        fields: expect.any(Object),
        defaultProps: expect.any(Object),
      });
      expect(res.body.dataSource).toBe("published");
      expect(res.body.hasDraft).toBe(false);
    });

    it("excludes draft gallery from public GET until publish", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      const readKey = await createKey({
        userId: TEST_USER_ID,
        scopes: ["sites:read"],
        name: "Read",
      });

      await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Gallery",
          props: { title: "Draft only", images: [{ url: "https://cdn.example/draft.jpg" }] },
        });

      const publicListed = await request(publicApp)
        .get(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${readKey.secret}`);
      expect(publicListed.status).toBe(200);
      expect(publicListed.body.data.dataSource).toBe("published");
      expect(publicListed.body.data.data.content.some((c) => c.type === "Gallery")).toBe(false);

      const ownerListed = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(ownerListed.status).toBe(200);
      expect(ownerListed.body.hasDraft).toBe(true);
      expect(ownerListed.body.dataSource).toBe("draft");
      expect(ownerListed.body.data.content.some((c) => c.type === "Gallery")).toBe(true);

      await request(ownerApp).post(`/api/portfolios/${site._id}/publish`);

      const afterPublish = await request(publicApp)
        .get(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${readKey.secret}`);
      expect(afterPublish.body.data.data.content.some((c) => c.type === "Gallery")).toBe(true);
    });

    it("rejects removing a non-feature hero section and leaves the draft intact", async () => {
      const site = await createOwnerPortfolio();
      const hero = site.sections[0];
      const writeKey = await issueWriteKey();

      const res = await request(publicApp)
        .delete(`/api/public/v1/sites/${site._id}/components/${hero._id}`)
        .set("Authorization", `Bearer ${writeKey.secret}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("not_a_component");

      const draft = await PortfolioDraft.findOne({ portfolioId: site._id }).lean();
      expect(draft).toBeTruthy();
      expect(draft.sections.some((s) => s.type === "hero")).toBe(true);
    });

    it("validates Puck props and returns slim mutation payloads", async () => {
      const site = await createOwnerPortfolio({ title: "Live Title" });
      const writeKey = await issueWriteKey();

      const bad = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Gallery",
          props: { title: "Pics", images: [{ url: "ftp://bad.example/a.jpg" }] },
        });
      expect(bad.status).toBe(400);

      const added = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "ContactLeadForm",
          props: { headline: "Reach us", enableForm: true },
        });
      expect(added.status).toBe(201);
      expect(added.body.data.portfolio).toBeUndefined();
      expect(added.body.data.section.blockType).toBe("contact");
      expect(added.body.data.section.type).toBe("ContactLeadForm");

      const live = await Portfolio.findById(site._id).lean();
      expect(live.sections.some((s) => s.type === "contact")).toBe(false);
    });

    it("rejects invalid reorder sectionIds", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();

      const add1 = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Services",
          props: { title: "S1", items: [{ title: "A", description: "" }] },
        });
      const add2 = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Gallery",
          props: { title: "G1", images: [{ url: "https://cdn.example/x.jpg" }] },
        });

      expect(add1.status).toBe(201);
      expect(add2.status).toBe(201);

      const ownerListed = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      const componentIds = ownerListed.body.data.content.map((item) => item.props.id).filter(Boolean);
      expect(componentIds).toHaveLength(2);

      const dup = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components/reorder`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ sectionIds: [componentIds[0], componentIds[0]] });
      expect(dup.status).toBe(400);

      const partial = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components/reorder`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ sectionIds: [componentIds[0]] });
      expect(partial.status).toBe(400);

      const ok = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components/reorder`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ sectionIds: [...componentIds].reverse() });
      expect(ok.status).toBe(200);
      expect(ok.body.data.sections[0].sectionId).toBe(componentIds[1]);
      expect(ok.body.data.portfolio).toBeUndefined();
    });

    it("lists components via MCP when enabled", async () => {
      const site = await createOwnerPortfolio();
      const key = await createKey({ userId: TEST_USER_ID, scopes: ["sites:read"], name: "MCP" });

      const tools = await request(mcpApp)
        .post("/api/mcp")
        .set("Authorization", `Bearer ${key.secret}`)
        .set("Accept", "application/json, text/event-stream")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
      const toolsText = JSON.stringify(tools.body);
      expect(toolsText).toContain("list_components");
      expect(toolsText).toContain("add_component");
      expect(toolsText).toContain("reorder_components");

      const listed = await request(mcpApp)
        .post("/api/mcp")
        .set("Authorization", `Bearer ${key.secret}`)
        .set("Accept", "application/json, text/event-stream")
        .send({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "list_components", arguments: { siteId: String(site._id) } },
        });
      const body = typeof listed.body === "string" ? JSON.parse(listed.body) : listed.body;
      expect(JSON.stringify(body)).toContain("ContactLeadForm");
      expect(JSON.stringify(body)).toContain("dataMapping");
    });

    it("persists legacy section.data on add and lists Puck props", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();

      const res = await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({
          type: "Gallery",
          props: {
            title: "Facility tour",
            images: [{ url: "https://cdn.example/room.jpg", caption: "Front desk" }],
          },
        });
      expect(res.status).toBe(201);

      const draft = await PortfolioDraft.findOne({ portfolioId: site._id }).lean();
      const gallery = draft.sections.find((s) => s.type === "gallery");
      expect(gallery.data).toMatchObject({
        sectionTitle: "Facility tour",
        facilityImages: [{ url: "https://cdn.example/room.jpg", caption: "Front desk" }],
      });
      expect(gallery.data.images).toBeUndefined();

      const listed = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      const puckGallery = listed.body.data.content.find((c) => c.type === "Gallery");
      expect(puckGallery.props).toMatchObject({
        title: "Facility tour",
        images: [{ url: "https://cdn.example/room.jpg", caption: "Front desk" }],
      });
    });

    it("lists Puck-shaped gallery sections without corrupting stored data", async () => {
      const site = await createOwnerPortfolio({
        sections: [
          { type: "hero", order: 0, data: { headline: "Welcome" } },
          {
            type: "gallery",
            order: 1,
            data: {
              title: "Legacy puck blob",
              images: [{ url: "https://cdn.example/legacy.jpg", caption: "Still works" }],
            },
          },
        ],
      });

      const res = await request(ownerApp).get(`/api/portfolios/components?siteId=${site._id}`);
      expect(res.status).toBe(200);
      const gallery = res.body.data.content.find((c) => c.type === "Gallery");
      expect(gallery.props.title).toBe("Legacy puck blob");
      expect(gallery.props.images[0].url).toBe("https://cdn.example/legacy.jpg");
    });

    it("merge-preserves contact legacy fields on update", async () => {
      const site = await createOwnerPortfolio({
        sections: [
          { type: "hero", order: 0, data: { headline: "Welcome" } },
          {
            type: "contact",
            order: 1,
            data: {
              headline: "Old",
              title: "Old",
              email: "desk@example.test",
              phone: "555-0199",
            },
          },
        ],
      });
      const writeKey = await issueWriteKey();
      const contactSection = site.sections.find((s) => s.type === "contact");

      await request(publicApp)
        .patch(`/api/public/v1/sites/${site._id}/components/${contactSection._id}`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ props: { headline: "Updated headline" } });

      const draft = await PortfolioDraft.findOne({ portfolioId: site._id }).lean();
      const contact = draft.sections.find((s) => s.type === "contact");
      expect(contact.data.email).toBe("desk@example.test");
      expect(contact.data.phone).toBe("555-0199");
      expect(contact.data.headline).toBe("Updated headline");
      expect(contact.data.submitText).toBeTruthy();
    });

    it("routes contact form submission through leads pipeline", async () => {
      const site = await createOwnerPortfolio();
      const writeKey = await issueWriteKey();
      await request(publicApp)
        .post(`/api/public/v1/sites/${site._id}/components`)
        .set("Authorization", `Bearer ${writeKey.secret}`)
        .send({ type: "ContactLeadForm", props: { headline: "Contact", enableForm: true } });

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