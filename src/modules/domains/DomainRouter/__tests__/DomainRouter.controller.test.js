jest.mock("../DomainRouter.model");
jest.mock("../DomainRouter.service");
jest.mock("../utils/domainHelpers");
jest.mock("../../domain.service");
jest.mock("../../../portfolios/models/Portfolio", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../../shared/middleware/auth", () => (req, res, next) => {
  req.user = {
    _id: "user123",
    portfolios: [{ portfolioId: "port1", portfolioType: "photographer" }],
  };
  next();
});

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const DomainRoute = require("../DomainRouter.model");
const Portfolio = require("../../../portfolios/models/Portfolio");
const { createDomainMapping } = require("../DomainRouter.service");
const { normalizeDomain } = require("../utils/domainHelpers");
const { addDomainToUser } = require("../../domain.service");

const app = express();
app.use(express.json());
app.use("/api/domains/router", require("../DomainRouter.routes"));

beforeEach(() => jest.clearAllMocks());

describe("POST /api/domains/router", () => {
  test("creates a domain mapping and returns 201", async () => {
    createDomainMapping.mockResolvedValue({ domain: "example.com" });

    const res = await request(app)
      .post("/api/domains/router")
      .send({ domain: "example.com" });

    expect(res.status).toBe(201);
    expect(res.body.domain).toBe("example.com");
  });

  test("returns 409 if domain already mapped", async () => {
    const err = new Error("Domain already mapped");
    err.status = 409;
    createDomainMapping.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/domains/router")
      .send({ domain: "example.com" });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/domains/router", () => {
  test("returns user domain routes", async () => {
    DomainRoute.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ domain: "example.com" }]),
      }),
    });

    const res = await request(app).get("/api/domains/router");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("DELETE /api/domains/router/:id", () => {
  test("returns 404 if mapping not found", async () => {
    DomainRoute.findById.mockResolvedValue(null);

    const res = await request(app).delete("/api/domains/router/abc123");
    expect(res.status).toBe(404);
  });

  test("returns 403 if user does not own the mapping", async () => {
    DomainRoute.findById.mockResolvedValue({
      userId: { equals: jest.fn().mockReturnValue(false) },
    });

    const res = await request(app).delete("/api/domains/router/abc123");
    expect(res.status).toBe(403);
  });

  test("deletes successfully", async () => {
    DomainRoute.findById.mockResolvedValue({
      userId: { equals: jest.fn().mockReturnValue(true) },
      deleteOne: jest.fn().mockResolvedValue({}),
    });

    const res = await request(app).delete("/api/domains/router/abc123");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Mapping deleted");
  });
});

describe("GET /api/domains/router/lookup", () => {
  test("returns portfolioId and type for known domain", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        portfolioId: "port1",
        portfolioType: "photographer",
      }),
    });

    const res = await request(app).get("/api/domains/router/lookup?domain=example.com");
    expect(res.status).toBe(200);
    expect(res.body.portfolioType).toBe("photographer");
  });

  test("returns 404 for unknown domain", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get("/api/domains/router/lookup?domain=unknown.com");
    expect(res.status).toBe(404);
  });

  test("falls back to a public portfolio slug on the platform host", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    Portfolio.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          template: "photographer",
        }),
      }),
    });

    const res = await request(app).get(
      "/api/domains/router/lookup?domain=public-slug.findvirtual.me",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      portfolioId: "507f1f77bcf86cd799439011",
      portfolioType: "photographer",
    });
    expect(Portfolio.findOne).toHaveBeenCalledWith({
      slug: "public-slug",
      visibility: "public",
    });
  });

  test("returns 404 for a private portfolio on the platform host", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    Portfolio.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app).get(
      "/api/domains/router/lookup?domain=private-slug.findvirtual.me",
    );
    expect(res.status).toBe(404);
  });

  test("returns 404 for reserved platform labels", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get(
      "/api/domains/router/lookup?domain=api.findvirtual.me",
    );
    expect(res.status).toBe(404);
    expect(Portfolio.findOne).not.toHaveBeenCalled();
  });

  test("prefers an existing domain route over slug fallback", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        portfolioId: "mapped-id",
        portfolioType: "project_manager",
      }),
    });

    const res = await request(app).get(
      "/api/domains/router/lookup?domain=mapped.findvirtual.me",
    );
    expect(res.status).toBe(200);
    expect(res.body.portfolioId).toBe("mapped-id");
    expect(Portfolio.findOne).not.toHaveBeenCalled();
  });
});