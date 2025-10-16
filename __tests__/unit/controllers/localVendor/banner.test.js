jest.unmock("../../../../models/localFoodVendor/Banner");
jest.mock("../../../../utils/multer", () => ({
  single: () => (req, res, next) => {
    req.file = null; // No file in tests
    next();
  },
}));

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bannerRoutes = require("../../../../routes/localFoodVendor/bannerRoutes");
const app = express();
app.use(express.json());
app.use("/banner", bannerRoutes);

const Banner = require("../../../../models/localFoodVendor/Banner");
//setup mongoMemoryServer in place of Atlas server
//connect mongoose to provided uri
let mongoServer;
beforeAll(async () => {
  // Prevent connecting to real databases accidentally
  if (process.env.MONGO_URI && process.env.MONGO_URI.includes("mongodb.net")) {
    throw new Error("❌ Refusing to connect to real MongoDB Atlas in test!");
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Banner.deleteMany();
});

describe("Banner API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  it("should fetch all banners for a vendor", async () => {
    const fakeBanners = [
      { vendorId, title: "Welcome", description: "Fresh food" },
      { vendorId, title: "Deals", description: "Discounts" },
    ];
    await Banner.insertMany(fakeBanners);

    const res = await request(app).get(`/banner/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].vendorId).toBe(vendorId);
  });

  it("should create a new banner", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const payload = {
      title: "Grand Opening",
      description: "Big discounts",
      shape: "fullscreen",
    };

    const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

    // Use util.inspect for deep objects

    expect(res.status).toBe(201);

    // Mongoose returns ObjectId objects, need to convert to string for comparison
    expect(res.body.vendorId.toString()).toBe(vendorId.toString());
    expect(res.body.title).toBe(payload.title);
    expect(res.body.description).toBe(payload.description);
    expect(res.body.shape).toBe(payload.shape);
    expect(res.body._id).toBeDefined();

    // Verify it's actually in the database
    const savedBanner = await Banner.findById(res.body._id);
    expect(savedBanner).toBeTruthy();
    expect(savedBanner.vendorId.toString()).toBe(vendorId.toString());
  });

  it("should update an existing banner", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    // First, create a banner to update
    const banner = await Banner.create({
      vendorId,
      title: "Old Title",
      description: "Old Description",
      shape: "square",
    });

    const updatePayload = {
      title: "Updated Title",
      description: "Updated Description",
      shape: "blob",
    };

    const res = await request(app)
      .put(`/banner/${vendorId.toString()}/${banner._id.toString()}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe(updatePayload.title);
    expect(res.body.description).toBe(updatePayload.description);
    expect(res.body.shape).toBe(updatePayload.shape);

    // Verify it was actually updated in the database
    const updatedBanner = await Banner.findById(banner._id);
    expect(updatedBanner.title).toBe(updatePayload.title);
    expect(updatedBanner.description).toBe(updatePayload.description);
    expect(updatedBanner.shape).toBe(updatePayload.shape);
  });

  it("should update banner without changing shape if not provided", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    const banner = await Banner.create({
      vendorId,
      title: "Old Title",
      description: "Old Description",
      shape: "oval",
    });

    const updatePayload = {
      title: "Updated Title",
      description: "Updated Description",
      // shape not provided
    };

    const res = await request(app)
      .put(`/banner/${vendorId.toString()}/${banner._id.toString()}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe(updatePayload.title);
    expect(res.body.shape).toBe("oval"); // Should remain unchanged
  });

  it("should return 404 if updating non-existing banner", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/banner/${vendorId.toString()}/${fakeId.toString()}`)
      .send({ title: "No Banner" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");
  });

  it("should not update banner belonging to different vendor", async () => {
    const vendorId1 = new mongoose.Types.ObjectId();
    const vendorId2 = new mongoose.Types.ObjectId();

    // Create banner for vendor1
    const banner = await Banner.create({
      vendorId: vendorId1,
      title: "Vendor 1 Banner",
      description: "Original",
    });

    // Try to update as vendor2
    const res = await request(app)
      .put(`/banner/${vendorId2.toString()}/${banner._id.toString()}`)
      .send({ title: "Hacked!" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");

    // Verify original banner wasn't changed
    const unchangedBanner = await Banner.findById(banner._id);
    expect(unchangedBanner.title).toBe("Vendor 1 Banner");
  });

  it("should return 404 when deleting non-existing banner", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app).delete(
      `/banner/${vendorId.toString()}/${fakeId.toString()}`
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");
  });

  it("should not delete banner belonging to different vendor", async () => {
    const vendorId1 = new mongoose.Types.ObjectId();
    const vendorId2 = new mongoose.Types.ObjectId();

    // Create banner for vendor1
    const banner = await Banner.create({
      vendorId: vendorId1,
      title: "Vendor 1 Banner",
      description: "Should not be deleted",
    });

    // Try to delete as vendor2
    const res = await request(app).delete(
      `/banner/${vendorId2.toString()}/${banner._id.toString()}`
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");

    // Verify banner still exists
    const stillExists = await Banner.findById(banner._id);
    expect(stillExists).toBeTruthy();
  });

  it("should handle errors when creating a banner", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    // Send invalid data (missing required field)
    const payload = {
      description: "Big discounts",
      // title is missing - it's required!
    };

    const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Failed to create banner");
  });

  it("should handle validation error for invalid shape", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    const payload = {
      title: "Grand Opening",
      description: "Big discounts",
      shape: "invalid-shape", // Not in enum: ["blob", "oval", "square", "fullscreen"]
    };

    const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Failed to create banner");
  });

  it("should create banner with custom shape", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    const payload = {
      title: "Oval Banner",
      description: "Stylish",
      shape: "oval",
    };

    const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.shape).toBe("oval");
    expect(res.body.title).toBe("Oval Banner");
    expect(res.body.description).toBe("Stylish");

    // Verify it's in the database with correct shape
    const savedBanner = await Banner.findById(res.body._id);
    expect(savedBanner.shape).toBe("oval");
  });

  it("should create banner with default shape when not provided", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    const payload = {
      title: "Default Shape Banner",
      description: "Should use fullscreen",
      // shape not provided
    };

    const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.shape).toBe("fullscreen"); // Default value
  });

  it("should create banners with all allowed shapes", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const shapes = ["blob", "oval", "square", "fullscreen"];

    for (const shape of shapes) {
      const payload = {
        title: `${shape} Banner`,
        description: `Testing ${shape} shape`,
        shape: shape,
      };

      const res = await request(app).post(`/banner/${vendorId.toString()}`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.shape).toBe(shape);
    }

    // Verify all 4 banners were created
    const allBanners = await Banner.find({ vendorId });
    expect(allBanners).toHaveLength(4);
  });
});
