const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const aboutRouter = require("../../routes/localFoodVendor/aboutRoutes");
const About = require("../../models/localFoodVendor/About");
const { uploadToS3 } = require("../../services/s3Service");
const { deleteFromS3 } = require("../../services/s3Service");

// Build isolated app
const app = express();
app.use(express.json());
app.use("/about", aboutRouter);

// Mock auth middleware only (keep logic real)
jest.mock("../../middleware/auth", () => (req, _res, next) => {
  req.user = { email: "test@example.com" };
  next();
});

// mock s3Service BEFORE importing any controller or route
jest.mock("../../services/s3Service", () => ({
  uploadToS3: jest.fn(async () => "mocked-s3-url"),
  deleteFromS3: jest.fn(async () => true),
}));

afterEach(async () => {
  await About.deleteMany();
});

describe("GET /about/:vendorId", () => {
  it("should return 200 and about content if found", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    await About.create({
      vendorId,
      banner: { title: "About Us", description: "We sell food" },
      contentBlocks: [{ heading: "Our Story" }],
      gridImages: ["/uploads/img1.jpg"],
    });

    const res = await request(app).get(`/about/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body.banner.title).toBe("About Us");
    expect(res.body.banner.description).toBe("We sell food");
  });

  it("should return 404 if vendor has no about content", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/about/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /about/:vendorId", () => {
  it("should create or upsert about content", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/about/${vendorId}`)
      .send({ title: "New Title", description: "Fresh description" });
    expect(res.status).toBe(201);
    expect(res.body.banner.title).toBe("New Title");
  });

  it("should upload multiple images successfully", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/about/${vendorId}/upload-grid-images`)
      .attach("images", Buffer.from("mock"), "img1.jpg")
      .attach("images", Buffer.from("mock"), "img2.jpg");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.urls)).toBe(true);
  });

  it("should return 500 if uploadToS3 throws", async () => {
    // Override the default successful mock
    uploadToS3.mockRejectedValueOnce(new Error("S3 upload failed"));

    const vendorId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/about/${vendorId}/upload-grid-images`)
      .attach("images", Buffer.from("mock"), "img1.jpg");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to upload/i);
  });
});

jest.spyOn(About, "findOne").mockResolvedValueOnce({
  banner: { title: "Grid test" },
  gridImages: [],
  save: jest.fn().mockResolvedValue({
    gridImages: [{ url: "a.jpg" }, { url: "b.jpg" }],
  }),
});

describe("PUT /about/:vendorId", () => {
  it("should update about content", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    await About.create({
      vendorId,
      banner: { title: "Old Title", description: "Old description" },
    });

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ title: "Updated", description: "Changed" });
    expect(res.status).toBe(200);
    expect(res.body.banner.title).toBe("Updated");
  });

  it("should parse contentBlocks when provided as JSON string", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const about = await About.create({ vendorId, banner: { title: "Old" } });

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ contentBlocks: JSON.stringify([{ heading: "Parsed Story" }]) });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.contentBlocks)).toBe(true);
    expect(res.body.contentBlocks[0].heading).toBe("Parsed Story");
  });

  it("should handle gridImages as plain array and filter duplicates", async () => {
    const vendorId = new mongoose.Types.ObjectId();

    jest.spyOn(About, "findOne").mockResolvedValueOnce({
      vendorId,
      banner: { title: "Grid test" },
      gridImages: [],
      save: jest.fn().mockResolvedValue({
        gridImages: [{ url: "a.jpg" }, { url: "b.jpg" }],
      }),
    });

    const images = [
      { url: "a.jpg" },
      { url: "b.jpg" },
      { url: "a.jpg" }, // duplicate
    ];

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ gridImages: images });

    expect(res.status).toBe(200);
    expect(res.body.gridImages).toHaveLength(2);
  });

  it("should create a new About document when none exists", async () => {
    jest.spyOn(About, "findOne").mockResolvedValueOnce(null);
    const mockSave = jest.fn().mockResolvedValue({
      vendorId: "mock-vendor",
      banner: { title: "Auto Created" },
    });

    jest.spyOn(About.prototype, "save").mockImplementation(mockSave);

    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ title: "Auto Created" });

    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalled();
  });

  it("should append uploaded grid images and filter duplicates", async () => {
    uploadToS3.mockResolvedValueOnce({
      url: "https://mock-bucket.s3.amazonaws.com/img1.jpg",
      key: "img1-key",
    });
    uploadToS3.mockResolvedValueOnce({
      url: "https://mock-bucket.s3.amazonaws.com/img2.jpg",
      key: "img2-key",
    });

    const vendorId = new mongoose.Types.ObjectId();
    const about = await About.create({
      vendorId,
      gridImages: ["https://mock-bucket.s3.amazonaws.com/img1.jpg"],
    });

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .attach("gridImages", Buffer.from("mock"), "img1.jpg")
      .attach("gridImages", Buffer.from("mock"), "img2.jpg");

    expect(res.status).toBe(200);
    expect(res.body.gridImages.length).toBe(2);
  });

  it("should update only text fields (title, shape)", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    await About.create({
      vendorId,
      banner: { title: "Old", description: "Old Desc" },
    });

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ title: "New Title", shape: "Round" });

    expect(res.status).toBe(200);
    expect(res.body.banner.title).toBe("New Title");
  });

  it("should return 500 if updateAbout throws an error", async () => {
    jest.spyOn(About, "findOne").mockImplementationOnce(() => {
      throw new Error("DB crash");
    });

    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ title: "Error test" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to update/i);
  });
});

describe("DELETE /about/:vendorId/:aboutId", () => {
  it("should delete about content", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const aboutDoc = await About.create({
      vendorId,
      banner: { title: "To delete" },
    });

    const res = await request(app).delete(`/about/${vendorId}/${aboutDoc._id}`);
    expect(res.status).toBe(200);
  });

  it("should return 404 for non-existing content", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/about/${vendorId}/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it("should call deleteFromS3 for banner key and grid images", async () => {
    jest.spyOn(About, "findByIdAndDelete").mockResolvedValueOnce({
      banner: { key: "banner-key" },
      gridImages: ["https://mock-bucket.s3.amazonaws.com/a.jpg"],
    });

    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/about/${vendorId}/mock-id`);

    expect(res.status).toBe(200);
    expect(deleteFromS3).toHaveBeenCalledWith("banner-key");
    expect(deleteFromS3).toHaveBeenCalledTimes(2);
  });

  it("should return 500 if deleteAbout throws an error", async () => {
    jest
      .spyOn(About, "findByIdAndDelete")
      .mockRejectedValueOnce(new Error("delete failed"));

    const vendorId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/about/${vendorId}/mock-id`);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to delete/i);
  });
});
