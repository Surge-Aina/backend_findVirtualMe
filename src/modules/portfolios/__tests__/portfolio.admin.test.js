const express = require("express");
const request = require("supertest");
const Portfolio = require("../models/Portfolio");
const portfolioService = require("../portfolio.service");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";
const ADMIN_USER_ID = "507f1f77bcf86cd799439013";

let mockCurrentUser = {
  _id: TEST_USER_ID,
  id: TEST_USER_ID,
  role: "customer",
};

jest.mock("../../../shared/middleware/auth", () => (req, _res, next) => {
  req.user = { ...mockCurrentUser };
  next();
});

jest.mock("../../../shared/middleware/optionalAuth", () => (req, _res, next) => {
  if (req.headers["x-test-user"] === "admin") {
    req.user = {
      _id: ADMIN_USER_ID,
      id: ADMIN_USER_ID,
      role: "admin",
    };
  } else if (req.headers["x-test-user"] === "owner") {
    req.user = {
      _id: TEST_USER_ID,
      id: TEST_USER_ID,
      role: "customer",
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

async function createPortfolio(ownerId, overrides = {}) {
  return Portfolio.create({
    owner: ownerId,
    template: "agent",
    title: "Test portfolio",
    visibility: "private",
    slug: `admin-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sections: [{ type: "summary", order: 0, data: { name: "Example" } }],
    ...overrides,
  });
}

describe("Admin portfolio access", () => {
  let infoSpy;

  beforeEach(() => {
    mockCurrentUser = {
      _id: TEST_USER_ID,
      id: TEST_USER_ID,
      role: "customer",
    };
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  describe("canViewerAccessPortfolio / assertPortfolioOwner", () => {
    it("denies non-owner access to private portfolios", () => {
      const portfolio = { owner: TEST_USER_ID, visibility: "private" };
      expect(portfolioService.canViewerAccessPortfolio(portfolio, OTHER_USER_ID)).toBe(false);
    });

    it("allows admin viewers on private portfolios", () => {
      const portfolio = { owner: TEST_USER_ID, visibility: "private" };
      expect(
        portfolioService.canViewerAccessPortfolio(portfolio, ADMIN_USER_ID, { isAdmin: true })
      ).toBe(true);
    });

    it("rejects non-admin mutating another user's portfolio", async () => {
      const portfolio = await createPortfolio(OTHER_USER_ID);
      const check = await portfolioService.assertPortfolioOwner(portfolio._id, TEST_USER_ID, {
        isAdmin: false,
      });
      expect(check).toEqual({ ok: false, status: 403, error: "Forbidden" });
    });

    it("allows admin mutating another user's portfolio", async () => {
      const portfolio = await createPortfolio(OTHER_USER_ID);
      const check = await portfolioService.assertPortfolioOwner(portfolio._id, ADMIN_USER_ID, {
        isAdmin: true,
      });
      expect(check.ok).toBe(true);
      expect(check.isOwner).toBe(false);
    });
  });

  describe("GET /api/portfolios/admin", () => {
    it("returns 403 for non-admin users", async () => {
      const res = await request(app).get("/api/portfolios/admin");
      expect(res.status).toBe(403);
    });

    it("lists all portfolios for admin with pagination fields", async () => {
      mockCurrentUser = { _id: ADMIN_USER_ID, id: ADMIN_USER_ID, role: "admin" };
      await createPortfolio(TEST_USER_ID, { title: "One" });
      await createPortfolio(OTHER_USER_ID, { title: "Two" });

      const res = await request(app).get("/api/portfolios/admin?limit=10");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.portfolios.length).toBeGreaterThanOrEqual(2);
      expect(res.body.portfolios[0]).toMatchObject({
        ownerId: expect.anything(),
        type: "agent",
        title: expect.any(String),
        visibility: expect.stringMatching(/^(public|private)$/),
        updatedAt: expect.anything(),
      });
      expect(res.body).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  });

  describe("owner-scoped routes remain restricted", () => {
    it("GET /mine returns only the authenticated user's portfolios", async () => {
      await createPortfolio(TEST_USER_ID, { title: "Mine" });
      await createPortfolio(OTHER_USER_ID, { title: "Not mine" });

      const res = await request(app).get("/api/portfolios/mine");
      expect(res.status).toBe(200);
      const titles = res.body.portfolios.map((p) => p.title);
      expect(titles).toContain("Mine");
      expect(titles).not.toContain("Not mine");
    });

    it("non-owner cannot PATCH another user's private portfolio", async () => {
      const portfolio = await createPortfolio(OTHER_USER_ID, { title: "Locked" });

      const res = await request(app)
        .patch(`/api/portfolios/${portfolio._id}`)
        .send({ title: "Stolen" });

      expect(res.status).toBe(403);
      const fresh = await Portfolio.findById(portfolio._id).lean();
      expect(fresh.title).toBe("Locked");
    });
  });

  describe("admin view and edit", () => {
    it("allows admin to read a private portfolio by id", async () => {
      const portfolio = await createPortfolio(OTHER_USER_ID, {
        title: "Secret",
        visibility: "private",
      });

      const res = await request(app)
        .get(`/api/portfolios/${portfolio._id}`)
        .set("Authorization", "Bearer x")
        .set("x-test-user", "admin");

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Secret");
    });

    it("allows admin to update another user's portfolio and logs user id only", async () => {
      mockCurrentUser = { _id: ADMIN_USER_ID, id: ADMIN_USER_ID, role: "admin" };
      const portfolio = await createPortfolio(OTHER_USER_ID, { title: "Before admin" });

      const res = await request(app)
        .patch(`/api/portfolios/${portfolio._id}`)
        .send({ title: "After admin" });

      expect(res.status).toBe(200);
      expect(res.body.portfolio.title).toBe("After admin");

      const adminLog = infoSpy.mock.calls
        .map((call) => call[0])
        .find((line) => typeof line === "string" && line.includes("admin_portfolio_edit"));
      expect(adminLog).toBeDefined();
      const payload = JSON.parse(adminLog);
      expect(payload).toEqual({
        event: "admin_portfolio_edit",
        adminUserId: ADMIN_USER_ID,
        portfolioId: String(portfolio._id),
        action: expect.any(String),
      });
      expect(JSON.stringify(payload)).not.toMatch(/email|phone|@/i);
    });
  });
});