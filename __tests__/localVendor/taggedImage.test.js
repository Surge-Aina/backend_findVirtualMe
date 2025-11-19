require("../../setup");
//jest.unmock("multer");

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");

jest.mock("../../services/s3Service", () => ({
  uploadToS3: jest.fn().mockResolvedValue({
    url: "https://mock-bucket.s3.amazonaws.com/test.jpg",
    key: "mock-key",
  }),
  deleteFromS3: jest.fn().mockResolvedValue(true),
}));

const { uploadToS3 } = require("../../services/s3Service");

jest.mock("../../models/localFoodVendor/TaggedImage", () => {
  const dataStore = [];

  class MockTaggedImage {
    constructor(data) {
      Object.assign(this, data);
      this._id = this._id || `${dataStore.length + 1}`;
      this.tags = this.tags || [];
    }

    async save() {
      const idx = dataStore.findIndex((d) => d._id == this._id);
      if (idx >= 0) dataStore[idx] = this;
      else dataStore.push(this);
      return this;
    }

    static find(filter = {}) {
      const matched = dataStore.filter((img) =>
        Object.keys(filter).every((k) => img[k] == filter[k])
      );
      const result = matched.map((d) => new MockTaggedImage(d));

      // Return a Promise with .populate() support
      const promise = Promise.resolve(result);
      promise.populate = async () => result;
      return promise;
    }

    static findOne(filter = {}) {
      const found = dataStore.find((img) =>
        Object.keys(filter).every((k) => img[k] == filter[k])
      );
      const result = found ? new MockTaggedImage(found) : null;

      // Return a Promise with .populate() support
      const promise = Promise.resolve(result);
      promise.populate = async () => result;
      return promise;
    }

    static async findOneAndDelete(filter = {}) {
      const idx = dataStore.findIndex((img) =>
        Object.keys(filter).every((k) => img[k] == filter[k])
      );
      if (idx === -1) return null;
      const [deleted] = dataStore.splice(idx, 1);
      return new MockTaggedImage(deleted);
    }

    static async deleteMany() {
      dataStore.length = 0;
    }
  }

  return MockTaggedImage;
});

const TaggedImage = require("../../models/localFoodVendor/TaggedImage");

const taggedImageRoutes = require("../../routes/localFoodVendor/taggedImageRoutes");
const app = express();
app.use(express.json());
app.use("/tagged", taggedImageRoutes);

let vendorId;

beforeAll(() => {
  vendorId = new mongoose.Types.ObjectId().toString();
});

//Test cases
describe("Tagged Image API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  afterEach(async () => {
    jest.clearAllMocks();
    await TaggedImage.deleteMany();
  });

  //image upload test case
  it("should upload a new image successfully", async () => {
    const res = await request(app)
      .post(`/tagged/${vendorId}/upload`)
      .attach("image", Buffer.from("mock-data"), "test.jpg");

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toContain("mock-bucket");
    expect(uploadToS3).toHaveBeenCalled();
  });

  it("should return 400 if no file is uploaded", async () => {
    const res = await request(app).post(`/tagged/${vendorId}/upload`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it("should add a tag to an existing image", async () => {
    const image = new TaggedImage({ vendorId, imageUrl: "url", key: "key" });
    await image.save();

    const res = await request(app)
      .post(`/tagged/${vendorId}/${image._id}/tags`)
      .send({ x: 10, y: 20, label: "Burger", menuItemId: "123" });

    expect(res.status).toBe(200);
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.tags[0].label).toBe("Burger");
  });

  it("should return 404 if adding tag to non-existing image", async () => {
    const res = await request(app)
      .post(`/tagged/${vendorId}/doesNotExist/tags`)
      .send({ x: 1, y: 2, label: "Invalid" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Image not found");
  });

  it("should update an existing tag", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      key: "key",
      tags: [{ x: 5, y: 10, label: "Old", menuItem: "1" }],
    });
    await image.save();

    const res = await request(app)
      .put(`/tagged/${vendorId}/${image._id}/tags/0`)
      .send({ x: 7, y: 15, label: "Updated", menuItemId: "2" });

    expect(res.status).toBe(200);
    expect(res.body.tags[0].label).toBe("Updated");
  });

  it("should return 404 if updating non-existing tag index", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      key: "key",
      tags: [],
    });
    await image.save();

    const res = await request(app)
      .put(`/tagged/${vendorId}/${image._id}/tags/5`)
      .send({ label: "Invalid" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Tag not found");
  });

  it("should delete an existing tag", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      key: "key",
      tags: [{ label: "ToDelete", x: 1, y: 2 }],
    });
    await image.save();

    const res = await request(app).delete(
      `/tagged/${vendorId}/${image._id}/tags/0`
    );

    expect(res.status).toBe(200);
    expect(res.body.tags).toHaveLength(0);
  });

  it("should return 404 if deleting tag from non-existing image", async () => {
    const res = await request(app).delete(`/tagged/${vendorId}/noImg/tags/0`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Image not found");
  });

  it("should handle DB errors when adding tag", async () => {
    jest
      .spyOn(TaggedImage, "findOne")
      .mockRejectedValueOnce(new Error("DB fail"));

    const res = await request(app)
      .post(`/tagged/${vendorId}/fakeImage/tags`)
      .send({ x: 10, y: 20, label: "ErrorTag" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to add tag/i);
  });
});

describe("PUT /tagged/:vendorId/:imageId/tags/:tagIndex (updateTag)", () => {
  it("should return 404 if image is not found", async () => {
    const res = await request(app)
      .put(`/tagged/${vendorId}/nonexistentImage/tags/0`)
      .send({ label: "New Label" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/image not found/i);
  });

  it("should return 404 if tag index does not exist", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      key: "key",
      tags: [],
    });
    await image.save();

    const res = await request(app)
      .put(`/tagged/${vendorId}/${image._id}/tags/5`)
      .send({ label: "Invalid" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/tag not found/i);
  });

  it("should return 500 if save fails", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      key: "key",
      tags: [{ x: 1, y: 1, label: "Old" }],
    });
    await image.save();

    jest
      .spyOn(image, "save")
      .mockRejectedValueOnce(new Error("DB save failed"));

    const res = await request(app)
      .put(`/tagged/${vendorId}/${image._id}/tags/0`)
      .send({ label: "New" });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to update/i);
  });
});

describe("DELETE /tagged/:vendorId/:imageId/tags/:tagIndex (deleteTag)", () => {
  it("should return 404 if tag index invalid", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      tags: [{ label: "Only Tag" }],
    });
    await image.save();

    const res = await request(app).delete(
      `/tagged/${vendorId}/${image._id}/tags/5`
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/tag not found/i);
  });

  it("should return 500 if save throws error", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "url",
      tags: [{ label: "DeleteMe" }],
    });
    await image.save();

    jest.spyOn(image, "save").mockRejectedValueOnce(new Error("DB fail"));

    const res = await request(app).delete(
      `/tagged/${vendorId}/${image._id}/tags/0`
    );
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to delete/i);
  });
});

describe("GET /tagged/:vendorId/:imageId", () => {
  it("should return 404 if image not found", async () => {
    const res = await request(app).get(`/tagged/${vendorId}/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/image not found/i);
  });
});

describe("DELETE /tagged/:vendorId/:imageId (deleteTaggedImage)", () => {
  it("should return 404 if image not found", async () => {
    const res = await request(app).delete(`/tagged/${vendorId}/missing`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/image not found/i);
  });

  it("should return 500 if DB delete fails", async () => {
    jest
      .spyOn(TaggedImage, "findOneAndDelete")
      .mockRejectedValueOnce(new Error("Delete fail"));
    const res = await request(app).delete(`/tagged/${vendorId}/123`);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to delete tagged image/i);
  });

  it("should handle deleteFromS3 error gracefully", async () => {
    const image = new TaggedImage({
      vendorId,
      imageUrl: "https://mock-bucket.s3.amazonaws.com/test.jpg",
      key: "mock-key",
    });
    await image.save();

    const { deleteFromS3 } = require("../../services/s3Service");
    deleteFromS3.mockRejectedValueOnce(new Error("S3 delete failed"));

    const res = await request(app).delete(`/tagged/${vendorId}/${image._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/tagged image deleted/i);
  });
});

describe("GET /tagged/:vendorId (getAllTaggedImages)", () => {
  it("should return all tagged images for a vendor", async () => {
    // Arrange: insert two mock images
    const image1 = new TaggedImage({
      vendorId,
      imageUrl: "https://mock-bucket.s3.amazonaws.com/one.jpg",
      key: "one-key",
      tags: [{ label: "Pizza", x: 0.5, y: 0.5 }],
    });
    const image2 = new TaggedImage({
      vendorId,
      imageUrl: "https://mock-bucket.s3.amazonaws.com/two.jpg",
      key: "two-key",
      tags: [{ label: "Pasta", x: 0.4, y: 0.6 }],
    });
    await image1.save();
    await image2.save();

    // Act
    const res = await request(app).get(`/tagged/${vendorId}`);

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty("imageUrl");
    expect(res.body[0]).toHaveProperty("tags");
  });
});
