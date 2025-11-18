const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Model + router under test
const LocationPing = require("../../models/LocationPing");
const telemetryRouter = require("../../routes/telemetry");

// Mock geoip-lite so we can control lookup() return values
jest.mock("geoip-lite", () => ({
  lookup: jest.fn(),
}));
const geoip = require("geoip-lite");

let mongoServer;
let app;

beforeAll(async () => {
  // Spin up in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Mount express app
  app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use("/api/telemetry", telemetryRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await LocationPing.deleteMany({});
});

describe("telemetry routes", () => {
  test("POST /visit -> returns 201 with JSON (no ip field)", async () => {
    // Mock geoip result
    geoip.lookup.mockReturnValue({
      city: "Mountain View",
      region: "CA",
      country: "US",
    });

    const res = await request(app)
      .post("/api/telemetry/visit")
      .set("X-Forwarded-For", "8.8.8.8")
      .send({ page: "/dashboard" });

    expect(res.status).toBe(201);

    // Ensure response does not leak IP
    expect(res.body).not.toHaveProperty("ip");

    expect(res.body).toMatchObject({
      message: "Telemetry stored",
      city: "Mountain View",
      region: "CA",
      country: "US",
      page: "/dashboard",
    });

    // Verify DB insert
    const doc = await LocationPing.findOne({ page: "/dashboard" }).lean();
    expect(doc).toBeTruthy();
    expect(doc.city).toBe("Mountain View");
  });

  test("POST /visit without page -> defaults to '/visit'", async () => {
    geoip.lookup.mockReturnValue({
      city: "Boston",
      region: "MA",
      country: "US",
    });

    const res = await request(app)
      .post("/api/telemetry/visit")
      .set("X-Forwarded-For", "1.1.1.1")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.page).toBe("/visit");

    const doc = await LocationPing.findOne({ page: "/visit" }).lean();
    expect(doc.city).toBe("Boston");
  });

  test("POST /visit when geoip returns null -> uses 'Unknown' values", async () => {
    geoip.lookup.mockReturnValue(null);
    const res = await request(app)
      .post("/api/telemetry/visit")
      .set("X-Forwarded-For", "203.0.113.5")
      .send({ page: "/about" });

    expect(res.status).toBe(201);

    expect(res.body).not.toHaveProperty("ip");
    expect(res.body).toMatchObject({
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      page: "/about",
    });

    const doc = await LocationPing.findOne({ page: "/about" }).lean();
    expect(doc.city).toBe("Unknown");
  });

  test("GET /stats/city-7d -> aggregates top cities", async () => {
    await LocationPing.create([
      { city: "Seattle", region: "WA", country: "US", page: "/a", ts: new Date() },
      { city: "Seattle", region: "WA", country: "US", page: "/b", ts: new Date() },
      { city: "Paris", region: "IDF", country: "FR", page: "/a", ts: new Date() },
    ]);

    const res = await request(app).get("/api/telemetry/stats/city-7d");
    expect(res.status).toBe(200);

    const rows = res.body;
    expect(Array.isArray(rows)).toBe(true);

    const seattle = rows.find((r) => r.city === "Seattle" && r.country === "US");
    const paris = rows.find((r) => r.city === "Paris" && r.country === "FR");

    expect(seattle?.count).toBe(2);
    expect(paris?.count).toBe(1);
  });

  test("POST /visit server error -> returns 500", async () => {
    geoip.lookup.mockImplementation(() => {
      throw new Error("boom");
    });

    const res = await request(app)
      .post("/api/telemetry/visit")
      .set("X-Forwarded-For", "8.8.4.4")
      .send({ page: "/oops" });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");

    const count = await LocationPing.countDocuments({});
    expect(count).toBe(0);
  });
});
