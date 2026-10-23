const mongoose = require("mongoose");
const { createRateLimiter } = require("../rateLimit");
const { resetRateBucketStateForTests } = require("../rateBucket");

const IP = "203.0.113.50";

function invoke(middleware, ip = IP) {
  return new Promise((resolve) => {
    const req = {
      headers: {},
      socket: { remoteAddress: ip },
      body: {},
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
    };
    middleware(req, res, () => resolve({ status: 200, body: null }));
  });
}

describe("shared mongo rate buckets", () => {
  const limiter = createRateLimiter({
    name: "mongo-probe",
    windowMs: 60 * 60 * 1000,
    max: 2,
    keyFn: (req) => req.socket.remoteAddress,
  });

  beforeEach(async () => {
    resetRateBucketStateForTests();
    await limiter.reset();
  });

  test("increments the api_rate_buckets counter", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect((await invoke(limiter)).status).toBe(200);
    expect((await invoke(limiter)).status).toBe(200);
    const limited = await invoke(limiter);
    expect(limited.status).toBe(429);

    const docs = await mongoose.connection.db.collection("api_rate_buckets")
      .find({ _id: { $regex: "^mongo-probe:" } })
      .toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].count).toBe(3);
    expect(docs[0].expireAt).toBeInstanceOf(Date);
    expect(docs[0]._id).toContain(IP);

    const indexes = await mongoose.connection.db.collection("api_rate_buckets").indexes();
    const ttl = indexes.find((idx) => idx.name === "expireAt_1");
    expect(ttl && ttl.expireAfterSeconds).toBe(0);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("rate_limit_degraded");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(IP);
  });

  test("repairs a non-TTL expireAt index and still counts", async () => {
    const col = mongoose.connection.db.collection("api_rate_buckets");
    await col.dropIndex("expireAt_1").catch(() => {});
    await col.createIndex({ expireAt: 1 }, { name: "expireAt_1" });
    resetRateBucketStateForTests();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect((await invoke(limiter, "203.0.113.51")).status).toBe(200);

    const indexes = await col.indexes();
    const ttl = indexes.find((idx) => idx.key && idx.key.expireAt === 1);
    expect(ttl.expireAfterSeconds).toBe(0);
    const docs = await col.find({ _id: { $regex: "^mongo-probe:" } }).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].count).toBe(1);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("rate_limit_degraded");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("203.0.113.51");
  });

  test("logs the error class without the bucket key when the write fails", async () => {
    const db = mongoose.connection.db;
    await db.collection("api_rate_buckets").insertOne({ _id: "seed", count: 0, expireAt: new Date() });
    await db.command({
      collMod: "api_rate_buckets",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["forbiddenField"],
        },
      },
      validationAction: "error",
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect((await invoke(limiter)).status).toBe(200);
      const degraded = errorSpy.mock.calls.filter((call) => call[0] === "rate_limit_degraded");
      expect(degraded).toHaveLength(1);
      expect(degraded[0][0]).toBe("rate_limit_degraded");
      expect(degraded[0][1]).toBe("mongo-probe");
      expect(degraded[0][2]).toMatch(/^MongoServerError:\d+$/);
      expect(degraded[0]).toHaveLength(3);
      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain(IP);
      expect(logged).not.toContain("forbiddenField");
    } finally {
      await db.command({
        collMod: "api_rate_buckets",
        validator: {},
        validationLevel: "off",
      });
    }
  });
});
