const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Portfolio = require("../models/Portfolio");
const PortfolioDraft = require("../models/PortfolioDraft");
const PortfolioVersion = require("../models/PortfolioVersion");
const portfolioService = require("../portfolio.service");
const portfolioDraftService = require("../portfolioDraft.service");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = {
    _id: TEST_USER_ID,
    id: TEST_USER_ID,
    email: "owner@example.com",
  };
  next();
});

jest.mock("../../../shared/middleware/optionalAuth", () => (req, _res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token === "owner-token") {
    req.user = {
      _id: TEST_USER_ID,
      id: TEST_USER_ID,
      email: "owner@example.com",
    };
  }
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

const app = express();
app.use(express.json());
app.use("/api/portfolios", portfolioRoutes);

async function createPublicPortfolio(overrides = {}) {
  return Portfolio.create({
    owner: TEST_USER_ID,
    template: "agent",
    title: "Live Site",
    visibility: "public",
    slug: `drafts-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sections: [
      { type: "summary", order: 0, data: { name: "Before Publish" } },
    ],
    ...overrides,
  });
}

describe("Portfolio drafts and version history", () => {
  const originalFlag = process.env.SITE_DRAFTS_ENABLED;

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.SITE_DRAFTS_ENABLED;
    } else {
      process.env.SITE_DRAFTS_ENABLED = originalFlag;
    }
  });

  describe("SITE_DRAFTS_ENABLED=false", () => {
    beforeEach(() => {
      process.env.SITE_DRAFTS_ENABLED = "false";
    });

    it("updates the live portfolio document immediately", async () => {
      const portfolio = await createPublicPortfolio();

      const res = await request(app)
        .patch(`/api/portfolios/${portfolio._id}`)
        .send({ title: "Edited Live" });

      expect(res.status).toBe(200);
      expect(res.body.portfolio.title).toBe("Edited Live");

      const live = await Portfolio.findById(portfolio._id).lean();
      expect(live.title).toBe("Edited Live");
      expect(await PortfolioDraft.countDocuments()).toBe(0);
    });

    it("hides draft-only routes", async () => {
      const portfolio = await createPublicPortfolio();
      const res = await request(app).post(`/api/portfolios/${portfolio._id}/publish`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("DRAFTS_DISABLED");
    });
  });

  describe("SITE_DRAFTS_ENABLED=true", () => {
    beforeEach(() => {
      process.env.SITE_DRAFTS_ENABLED = "true";
    });

    it("updates via service layer into draft", async () => {
      const portfolio = await createPublicPortfolio({ title: "Svc Published" });
      const updated = await portfolioService.updatePortfolio(portfolio._id, {
        title: "Svc Draft",
      });
      expect(updated.title).toBe("Svc Draft");
      const live = await Portfolio.findById(portfolio._id).lean();
      expect(live.title).toBe("Svc Published");
    });

    it("keeps the public site unchanged until publish", async () => {
      const portfolio = await createPublicPortfolio({ title: "Published Title" });

      const patch = await request(app)
        .patch(`/api/portfolios/${portfolio._id}`)
        .send({ title: "Draft Title Only" });

      expect(patch.status).toBe(200);
      expect(patch.body.portfolio.title).toBe("Draft Title Only");
      expect(patch.body.portfolio.draftMode).toBe(true);

      const live = await Portfolio.findById(portfolio._id).lean();
      expect(live.title).toBe("Published Title");

      const anon = await request(app).get(`/api/portfolios/${portfolio._id}`);
      expect(anon.status).toBe(200);
      expect(anon.body.title).toBe("Published Title");
      expect(anon.body.draftMode).toBeUndefined();
    });

    it("publish creates a version and updates the live site", async () => {
      const portfolio = await createPublicPortfolio({ title: "V1 Live" });

      await request(app)
        .patch(`/api/portfolios/${portfolio._id}`)
        .send({ title: "V2 Draft" });

      const publish = await request(app).post(`/api/portfolios/${portfolio._id}/publish`);
      expect(publish.status).toBe(200);
      expect(publish.body.versionNumber).toBe(1);

      const live = await Portfolio.findById(portfolio._id).lean();
      expect(live.title).toBe("V2 Draft");
      expect(live.publishedVersionNumber).toBe(1);

      const versions = await PortfolioVersion.find({ portfolioId: portfolio._id }).lean();
      expect(versions).toHaveLength(1);
      expect(versions[0].snapshot.title).toBe("V2 Draft");
    });

    it("lists versions, previews one, and reverts into draft without publishing", async () => {
      const portfolio = await createPublicPortfolio({ title: "Alpha" });

      await request(app).patch(`/api/portfolios/${portfolio._id}`).send({ title: "Beta" });
      await request(app).post(`/api/portfolios/${portfolio._id}/publish`);

      await request(app).patch(`/api/portfolios/${portfolio._id}`).send({ title: "Gamma" });
      await request(app).post(`/api/portfolios/${portfolio._id}/publish`);

      const list = await request(app).get(`/api/portfolios/${portfolio._id}/versions`);
      expect(list.status).toBe(200);
      expect(list.body.versions.map((v) => v.versionNumber)).toEqual([2, 1]);

      const preview = await request(app).get(`/api/portfolios/${portfolio._id}/versions/1`);
      expect(preview.status).toBe(200);
      expect(preview.body.version.snapshot.title).toBe("Beta");

      const revert = await request(app).post(`/api/portfolios/${portfolio._id}/versions/1/revert`);
      expect(revert.status).toBe(200);
      expect(revert.body.draft.title).toBe("Beta");

      const live = await Portfolio.findById(portfolio._id).lean();
      expect(live.title).toBe("Gamma");
    });

    it("enforces owner auth on publish", async () => {
      const portfolio = await Portfolio.create({
        owner: OTHER_USER_ID,
        template: "agent",
        title: "Not mine",
        visibility: "public",
        sections: [{ type: "summary", order: 0, data: { name: "X" } }],
      });

      const check = await portfolioService.assertPortfolioOwner(portfolio._id, TEST_USER_ID);
      expect(check.ok).toBe(false);
      expect(check.status).toBe(403);

      const publish = await request(app).post(`/api/portfolios/${portfolio._id}/publish`);
      expect(publish.status).toBe(403);
    });

    it("retains at most MAX_VERSIONS_PER_SITE snapshots", async () => {
      const portfolio = await createPublicPortfolio({ title: "cap-test" });
      const cap = portfolioDraftService.MAX_VERSIONS_PER_SITE;

      for (let i = 1; i <= cap + 3; i += 1) {
        await request(app)
          .patch(`/api/portfolios/${portfolio._id}`)
          .send({ title: `iteration-${i}` });
        await request(app).post(`/api/portfolios/${portfolio._id}/publish`);
      }

      const count = await PortfolioVersion.countDocuments({ portfolioId: portfolio._id });
      expect(count).toBe(cap);

      const list = await portfolioDraftService.listVersions(portfolio._id);
      expect(list[0].versionNumber).toBe(cap + 3);
      expect(list[list.length - 1].versionNumber).toBe(4);
    });
  });
});