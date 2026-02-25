jest.unmock("multer");

jest.mock("multer", () => {
  const multer = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        buffer: Buffer.from("fake-image-data"),
        originalname: "test.jpg",
        mimetype: "image/jpeg",
      };
      next();
    }),
    array: jest.fn(() => (req, res, next) => {
      req.files = [
        {
          buffer: Buffer.from("img1"),
          originalname: "1.jpg",
          mimetype: "image/jpeg",
        },
        {
          buffer: Buffer.from("img2"),
          originalname: "2.jpg",
          mimetype: "image/jpeg",
        },
      ];
      next();
    }),
  }));
  multer.memoryStorage = jest.fn(() => ({}));
  return multer;
});

jest.mock("../../services/s3Service", () => ({
  uploadToS3: jest.fn(async () => ({
    url: "/uploads/test.jpg",
    key: "mock-key",
  })),
  deleteFromS3: jest.fn(async () => true),
}));

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const galleryRoutes = require("../../routes/localFoodVendor/galleryRoutes");
const GalleryImage = require("../../models/localFoodVendor/GalleryImage");

const app = express();
app.use(express.json());
app.use("/gallery", galleryRoutes);

app.post(
  "/gallery-nofile/:vendorId",
  (req, res, next) => {
    req.file = undefined;
    next();
  },
  require("../../controllers/localFoodVendor/galleryController")
    .createGalleryImage
);

app.post(
  "/gallery-nofiles/:vendorId/multiple",
  (req, res, next) => {
    req.files = undefined;
    next();
  },
  require("../../controllers/localFoodVendor/galleryController")
    .insertMultipleGalleryImage
);

describe("Gallery API (integration-style)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  it("should fetch all gallery images", async () => {
    await GalleryImage.insertMany([
      { vendorId, imageUrl: "/uploads/1.jpg", caption: "One" },
      { vendorId, imageUrl: "/uploads/2.jpg", caption: "Two" },
    ]);

    const res = await request(app).get(`/gallery/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("should create a new gallery image", async () => {
    const res = await request(app)
      .post(`/gallery/${vendorId}`)
      .send({ caption: "Nice pic" });

    expect(res.status).toBe(201);
    expect(res.body.caption).toBe("Nice pic");

    const saved = await GalleryImage.findById(res.body._id);
    expect(saved).toBeTruthy();
    expect(saved.vendorId.toString()).toBe(vendorId);
  });

  it("should insert multiple gallery images", async () => {
    const res = await request(app)
      .post(`/gallery/${vendorId}/multiple`)
      .send({ captions: ["One", "Two"] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);

    const all = await GalleryImage.find({ vendorId });
    expect(all).toHaveLength(2);
  });

  it("should update a gallery image", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "/uploads/old.jpg",
      caption: "Old",
    });

    const res = await request(app)
      .put(`/gallery/${vendorId}/${img._id}`)
      .send({ caption: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBe("Updated");

    const updated = await GalleryImage.findById(img._id);
    expect(updated.caption).toBe("Updated");
  });

  it("should return 404 if updating non-existing image", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/gallery/${vendorId}/${fakeId}`)
      .send({ caption: "Nope" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Gallery image not found");
  });

  it("should delete a gallery image", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "/uploads/test.jpg",
      caption: "To delete",
    });

    const res = await request(app).delete(`/gallery/${vendorId}/${img._id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gallery image deleted");

    const check = await GalleryImage.findById(img._id);
    expect(check).toBeNull();
  });

  it("should return 404 when deleting non-existing image", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app).delete(`/gallery/${vendorId}/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Gallery image not found");
  });

  it("should handle DB errors in getAllGalleryImages", async () => {
    jest.spyOn(GalleryImage, "find").mockRejectedValue(new Error("DB fail"));
    const res = await request(app).get(`/gallery/${vendorId}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch gallery images");
    GalleryImage.find.mockRestore();
  });

  it("should return 400 if no file is provided when creating", async () => {
    const res = await request(app)
      .post(`/gallery-nofile/${vendorId}`)
      .send({ caption: "No file" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Image file is required");
  });

  it("should return 400 if no files are provided for multiple insert", async () => {
    const res = await request(app)
      .post(`/gallery-nofiles/${vendorId}/multiple`)
      .send({ captions: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No images provided");
  });

  it("should warn if deleteFromS3 fails during update", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "/uploads/old.jpg",
      key: "old-key",
    });

    const { deleteFromS3 } = require("../../services/s3Service");
    deleteFromS3.mockRejectedValueOnce(new Error("S3 delete failed"));

    const res = await request(app)
      .put(`/gallery/${vendorId}/${img._id}`)
      .send({ caption: "Update after failed delete" });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBe("Update after failed delete");

    deleteFromS3.mockResolvedValue(true);
  });

  it("should handle deleteFromS3 failure gracefully when deleting", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "https://bucket.s3.amazonaws.com/uploads/test.jpg",
    });

    const { deleteFromS3 } = require("../../services/s3Service");
    deleteFromS3.mockRejectedValueOnce(new Error("S3 deletion failed"));

    const res = await request(app).delete(`/gallery/${vendorId}/${img._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gallery image deleted");

    deleteFromS3.mockResolvedValue(true);
  });

  it("should handle DB errors in deleteGalleryImage", async () => {
    jest
      .spyOn(GalleryImage, "findOneAndDelete")
      .mockRejectedValueOnce(new Error("DB delete fail"));

    const res = await request(app).delete(
      `/gallery/${vendorId}/${new mongoose.Types.ObjectId()}`
    );
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to delete gallery image");

    GalleryImage.findOneAndDelete.mockRestore();
  });

  //new ones
  it("should handle DB save failure during createGalleryImage", async () => {
    const saveMock = jest
      .spyOn(
        require("../../models/localFoodVendor/GalleryImage").prototype,
        "save"
      )
      .mockRejectedValueOnce(new Error("DB save error"));

    const res = await request(app).post(`/gallery/${vendorId}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Failed to create gallery image");

    saveMock.mockRestore();
  });

  it("should update image when key is missing (no deleteFromS3 call)", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "/uploads/old.jpg",
      caption: "No key image",
      key: undefined,
    });

    const res = await request(app)
      .put(`/gallery/${vendorId}/${img._id}`)
      .send({ caption: "Updated without key" });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBe("Updated without key");
  });

  it("should skip S3 delete if keyFromUrl returns null", async () => {
    const img = await GalleryImage.create({
      vendorId,
      imageUrl: "not-a-valid-url", // keyFromUrl will return null
      key: null,
    });

    const res = await request(app).delete(`/gallery/${vendorId}/${img._id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gallery image deleted");
  });

  it("should handle top-level deleteGalleryImage errors", async () => {
    jest.spyOn(GalleryImage, "findOneAndDelete").mockImplementationOnce(() => {
      throw new Error("Unexpected crash");
    });

    const res = await request(app).delete(
      `/gallery/${vendorId}/${new mongoose.Types.ObjectId()}`
    );

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to delete gallery image");

    GalleryImage.findOneAndDelete.mockRestore();
  });
});
