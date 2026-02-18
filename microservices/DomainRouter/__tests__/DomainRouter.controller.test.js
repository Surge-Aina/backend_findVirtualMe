jest.mock("../DomainRouter.model");
jest.mock("../DomainRouter.service");
jest.mock("../utils/domainHelpers");
jest.mock("../../../services/domainService");
jest.mock("../../../middleware/auth", () => (req, res, next) => {
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
const { createDomainMapping } = require("../DomainRouter.service");
const { normalizeDomain } = require("../utils/domainHelpers");
const { addDomainToUser } = require("../../../services/domainService");

const app = express();
app.use(express.json());
app.use("/domainRouter", require("../DomainRouter.routes"));

beforeEach(() => jest.clearAllMocks());

describe("POST /domainRouter", () => {
  test("creates a domain mapping and returns 201", async () => {
    createDomainMapping.mockResolvedValue({ domain: "example.com" });

    const res = await request(app)
      .post("/domainRouter")
      .send({ domain: "example.com" });

    expect(res.status).toBe(201);
    expect(res.body.domain).toBe("example.com");
  });

  test("returns 409 if domain already mapped", async () => {
    const err = new Error("Domain already mapped");
    err.status = 409;
    createDomainMapping.mockRejectedValue(err);

    const res = await request(app)
      .post("/domainRouter")
      .send({ domain: "example.com" });

    expect(res.status).toBe(409);
  });
});

describe("GET /domainRouter", () => {
  test("returns user domain routes", async () => {
    DomainRoute.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ domain: "example.com" }]),
      }),
    });

    const res = await request(app).get("/domainRouter");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("DELETE /domainRouter/:id", () => {
  test("returns 404 if mapping not found", async () => {
    DomainRoute.findById.mockResolvedValue(null);

    const res = await request(app).delete("/domainRouter/abc123");
    expect(res.status).toBe(404);
  });

  test("returns 403 if user does not own the mapping", async () => {
    DomainRoute.findById.mockResolvedValue({
      userId: { equals: jest.fn().mockReturnValue(false) },
    });

    const res = await request(app).delete("/domainRouter/abc123");
    expect(res.status).toBe(403);
  });

  test("deletes successfully", async () => {
    DomainRoute.findById.mockResolvedValue({
      userId: { equals: jest.fn().mockReturnValue(true) },
      deleteOne: jest.fn().mockResolvedValue({}),
    });

    const res = await request(app).delete("/domainRouter/abc123");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Mapping deleted");
  });
});

describe("GET /domainRouter/domainLookup", () => {
  test("returns portfolioId and type for known domain", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        portfolioId: "port1",
        portfolioType: "photographer",
      }),
    });

    const res = await request(app).get("/domainRouter/domainLookup?domain=example.com");
    expect(res.status).toBe(200);
    expect(res.body.portfolioType).toBe("photographer");
  });

  test("returns 404 for unknown domain", async () => {
    DomainRoute.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get("/domainRouter/domainLookup?domain=unknown.com");
    expect(res.status).toBe(404);
  });
});