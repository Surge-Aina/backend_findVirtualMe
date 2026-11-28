const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../payments/subscription-access.service", () => ({
  getActiveSubscriptionForUser: jest.fn().mockResolvedValue(null),
}));

const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const portfolioService = require("../../portfolios/portfolio.service");
const { getDefaultSections } = require("../../portfolios/models/templateDefaults");
const { createKey } = require("../apiKey.service");
const { mountPublicApi } = require("../mount");
const { resetPublicApiRateLimits } = require("../rateLimit");

const mockOwnerId = "507f1f77bcf86cd799439011";

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = {
    _id: mockOwnerId,
    id: mockOwnerId,
    role: "customer",
    email: "owner@example.test",
  };
  next();
});

const OWNER_ID = mockOwnerId;

const app = express();
app.use(express.json());
mountPublicApi(app);
const portfolioRoutes = require("../../portfolios/portfolio.routes");
app.use("/api/portfolios", portfolioRoutes);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function heroWithExtras(template) {
  const sections = JSON.parse(JSON.stringify(getDefaultSections(template)));
  const hero = sections.find((s) => s.type === "hero");
  if (template === "healthcare") {
    hero.data.backgroundImage = "https://cdn.example.test/bg.jpg";
    hero.data.logoImage = "https://cdn.example.test/logo.png";
    hero.data.pageBanner = { enabled: true, title: "Welcome" };
  }
  if (template === "handyman") {
    hero.data.imageUrl = "https://cdn.example.test/hero.jpg";
    hero.data.phoneNumber = "(555) 0100";
    hero.data.badge1Text = "Licensed";
  }
  return sections;
}

async function seedOwner() {
  return User.findOneAndUpdate(
    { _id: OWNER_ID },
    {
      username: `preserve_${nonce()}`,
      email: `preserve.${nonce()}@example.test`,
      password: "synthetic-password",
      userKey: `uk_${nonce()}`,
      practiceId: `pid_${nonce()}`,
      role: "customer",
      name: "Preserve Owner",
    },
    { upsert: true, new: true }
  );
}

describe("site tools field preservation", () => {
  beforeEach(async () => {
    resetPublicApiRateLimits();
    process.env.MCP_SITE_TOOLS_ENABLED = "true";
    await seedOwner();
  });

  it("keeps healthcare hero extras through dashboard and MCP edits", async () => {
    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "healthcare", {
      sections: heroWithExtras("healthcare"),
    });
    const hero = portfolio.sections.find((s) => s.type === "hero");
    await portfolioService.updateSection(portfolio._id, hero._id, {
      ...hero.data,
      description: "Dashboard edit",
    });
    const afterDashboard = await Portfolio.findById(portfolio._id).lean();
    const dashHero = afterDashboard.sections.find((s) => s.type === "hero");
    expect(dashHero.data.backgroundImage).toBe("https://cdn.example.test/bg.jpg");
    expect(dashHero.data.logoImage).toBe("https://cdn.example.test/logo.png");
    expect(dashHero.data.pageBanner).toMatchObject({ enabled: true });

    const key = await createKey({
      userId: OWNER_ID,
      scopes: ["sites:read", "sites:write"],
      name: "Healthcare",
    });
    await request(app)
      .patch(`/api/public/v1/sites/${portfolio._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { about: "MCP hero edit" } });

    const afterMcp = await Portfolio.findById(portfolio._id).lean();
    const mcpHero = afterMcp.sections.find((s) => s.type === "hero");
    expect(mcpHero.data.description).toBe("MCP hero edit");
    expect(mcpHero.data.backgroundImage).toBe("https://cdn.example.test/bg.jpg");
    expect(mcpHero.data.logoImage).toBe("https://cdn.example.test/logo.png");
  });

  it("keeps handyman contact extras when MCP patches email only", async () => {
    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "handyman");
    const key = await createKey({
      userId: OWNER_ID,
      scopes: ["sites:read", "sites:write"],
      name: "Handyman",
    });
    const patch = await request(app)
      .patch(`/api/public/v1/sites/${portfolio._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { contact: { email: "patched@example.test" } } });
    expect(patch.status).toBe(200);

    const doc = await Portfolio.findById(portfolio._id).lean();
    const contact = doc.sections.find((s) => s.type === "contact");
    expect(contact.data.email).toBe("patched@example.test");
    expect(contact.data.subtitle).toBeTruthy();
    expect(contact.data.formTitle).toBeTruthy();
    expect(contact.data.hours).toBeTruthy();
    expect(contact.data.note).toBeTruthy();
  });

  it("keeps dataScientist contact social fields when MCP patches phone only", async () => {
    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "dataScientist");
    const contact = portfolio.sections.find((s) => s.type === "contact");
    contact.data.linkedin = "https://linkedin.com/in/example";
    contact.data.github = "https://github.com/example";
    await portfolioService.updateSection(portfolio._id, contact._id, contact.data);

    const key = await createKey({
      userId: OWNER_ID,
      scopes: ["sites:read", "sites:write"],
      name: "DS",
    });
    await request(app)
      .patch(`/api/public/v1/sites/${portfolio._id}/content`)
      .set("Authorization", `Bearer ${key.secret}`)
      .send({ content: { contact: { phone: "555-1000" } } });

    const doc = await Portfolio.findById(portfolio._id).lean();
    const refreshed = doc.sections.find((s) => s.type === "contact");
    expect(refreshed.data.phone).toBe("555-1000");
    expect(refreshed.data.linkedin).toBe("https://linkedin.com/in/example");
    expect(refreshed.data.github).toBe("https://github.com/example");
    expect(refreshed.data.twitter).toBe("");
  });

  it("keeps default template fields on create for healthcare, handyman, and dataScientist", async () => {
    for (const template of ["healthcare", "handyman", "dataScientist"]) {
      const owner = new mongoose.Types.ObjectId();
      await User.create({
        _id: owner,
        username: `tmpl_${nonce()}`,
        email: `tmpl.${nonce()}@example.test`,
        password: "synthetic-password",
        userKey: `uk_${nonce()}`,
        practiceId: `pid_${nonce()}`,
        role: "customer",
        name: "Template Owner",
      });
      const created = await portfolioService.createPortfolio(owner, template, {
        title: template,
      });
      const doc = created.toObject ? created.toObject() : created;
      if (template === "healthcare") {
        const hero = doc.sections.find((s) => s.type === "hero");
        expect(hero.data).toHaveProperty("backgroundImage");
        expect(hero.data).toHaveProperty("logoImage");
        expect(hero.data).toHaveProperty("pageBanner");
      }
      if (template === "handyman") {
        const hero = doc.sections.find((s) => s.type === "hero");
        expect(hero.data.phoneNumber).toBeTruthy();
        expect(hero.data.badge1Text).toBeTruthy();
        expect(hero.data.ctaText).toBeTruthy();
      }
      if (template === "dataScientist") {
        const contact = doc.sections.find((s) => s.type === "contact");
        expect(contact.data).toMatchObject({
          linkedin: expect.any(String),
          github: expect.any(String),
          website: expect.any(String),
        });
      }
    }
  });
});