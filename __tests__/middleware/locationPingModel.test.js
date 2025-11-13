const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const LocationPing = require("../../models/LocationPing");

let mongoServer;

beforeAll(async () => {
  // Spin up in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Ensure a clean collection before each test
  await LocationPing.deleteMany({});
});

describe("LocationPing Model", () => {
  describe("Schema Basics", () => {
    it("should create a document with expected fields", async () => {
      // Note: userId is optional; page/city/region/country provided by route layer usually
      const ping = new LocationPing({
        userId: new mongoose.Types.ObjectId(),
        city: "Seattle",
        region: "WA",
        country: "US",
        page: "/dashboard",
      });

      await ping.save();

      expect(ping._id).toBeDefined();
      expect(ping.userId).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(ping.city).toBe("Seattle");
      expect(ping.region).toBe("WA");
      expect(ping.country).toBe("US");
      expect(ping.page).toBe("/dashboard");

      // 'ts' and 'createdAt' should be Dates with defaults
      expect(ping.ts).toBeInstanceOf(Date);
      expect(ping.createdAt).toBeInstanceOf(Date);
    });

    it("should allow creating a document without userId (anonymous)", async () => {
      const ping = await LocationPing.create({
        city: "Paris",
        region: "IDF",
        country: "FR",
        page: "/",
      });

      expect(ping.userId).toBeUndefined(); // userId is optional
      expect(ping.city).toBe("Paris");
      expect(ping.page).toBe("/");
    });

    it("should accept a custom 'ts' (business timestamp)", async () => {
      const customTs = new Date("2024-01-01T00:00:00.000Z");
      const ping = await LocationPing.create({
        city: "Boston",
        region: "MA",
        country: "US",
        page: "/about",
        ts: customTs,
      });

      expect(ping.ts.toISOString()).toBe(customTs.toISOString());
    });
  });

  describe("TTL Index (createdAt)", () => {
    it("should define TTL index on createdAt with 15 days (1296000 seconds)", async () => {
      // Ensure indexes are built in the in-memory MongoDB
      await LocationPing.syncIndexes();

      // Fetch indexes from MongoDB for this collection
      const indexes = await LocationPing.collection.getIndexes({ full: true });

      // Find the TTL index by key { createdAt: 1 }
      const ttlIdx = indexes.find(
        (idx) =>
          idx.key &&
          idx.key.createdAt === 1 &&
          (idx.expireAfterSeconds === 60 * 60 * 24 * 15 ||
            idx.expireAfterSeconds === 1296000)
      );

      expect(ttlIdx).toBeDefined();
      expect(ttlIdx.expireAfterSeconds).toBe(1296000);
    });

    // Note:
    // We do NOT wait for actual TTL expiration in tests because the TTL monitor
    // runs every ~60 seconds and would make tests slow/flaky. The test above
    // asserts the index is configured correctly, which is sufficient.
  });

  describe("Data Types & Minimal Inserts", () => {
    it("should save minimal location info (city/region/country/page) with defaults for dates", async () => {
      const doc = await LocationPing.create({
        city: "Unknown", // route may pass "Unknown" when geoip fails
        region: "Unknown",
        country: "US",
        page: "/visit",
      });

      const found = await LocationPing.findById(doc._id);
      expect(found).toBeTruthy();
      expect(found.page).toBe("/visit");
      expect(found.ts).toBeInstanceOf(Date);
      expect(found.createdAt).toBeInstanceOf(Date);
    });

    it("should store multiple rows and allow basic querying", async () => {
      await LocationPing.create([
        { city: "Seattle", region: "WA", country: "US", page: "/a" },
        { city: "Seattle", region: "WA", country: "US", page: "/b" },
        { city: "Paris", region: "IDF", country: "FR", page: "/a" },
      ]);

      const seattleCount = await LocationPing.countDocuments({ city: "Seattle" });
      const parisDoc = await LocationPing.findOne({ city: "Paris" });

      expect(seattleCount).toBe(2);
      expect(parisDoc).toBeTruthy();
      expect(parisDoc.country).toBe("FR");
    });
  });
});
