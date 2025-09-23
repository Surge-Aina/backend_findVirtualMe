const request = require("supertest");
const app = require("../testapp");
const mongoose = require("mongoose");

// Mock GalleryImage model
jest.mock("../models/GalleryImage", () => {
  const mockGallery = jest.fn(function (data) {
    Object.assign(this, data);
    this.save = jest.fn();
  });

  mockGallery.find = jest.fn();
  mockGallery.findOneAndUpdate = jest.fn();
  mockGallery.findOneAndDelete = jest.fn();
  mockGallery.insertMany = jest.fn();

  return mockGallery;
});

const GalleryImage = require("../models/GalleryImage");

describe("Gallery API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all gallery images", async () => {
    const fakeImages = [{ _id: "img1", vendorId, imageUrl: "/uploads/1.jpg" }];
    GalleryImage.find.mockResolvedValueOnce(fakeImages);

    const res = await request(app).get(`/gallery/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body[0]._id).toBe("img1");
    expect(GalleryImage.find).toHaveBeenCalledWith({ vendorId });
  });

  it("should create a new gallery image", async () => {
    const fakeSaved = {
      _id: "img2",
      vendorId,
      imageUrl: "/uploads/test.jpg",
      caption: "Nice pic",
    };

    GalleryImage.mockImplementationOnce(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(fakeSaved);
    });

    const res = await request(app)
      .post(`/gallery/${vendorId}`)
      .send({ caption: "Nice pic" });

    expect(res.status).toBe(201);
    expect(res.body.caption).toBe("Nice pic");
  });

  it("should insert multiple gallery images", async () => {
    const fakeInserted = [
      { _id: "img3", vendorId, imageUrl: "/uploads/1.jpg", caption: "One" },
      { _id: "img4", vendorId, imageUrl: "/uploads/2.jpg", caption: "Two" },
    ];
    GalleryImage.insertMany.mockResolvedValueOnce(fakeInserted);

    const res = await request(app)
      .post(`/gallery/${vendorId}/multiple`)
      .send({ captions: ["One", "Two"] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(GalleryImage.insertMany).toHaveBeenCalled();
  });

  it("should update a gallery image", async () => {
    const fakeUpdated = {
      _id: "img5",
      vendorId,
      imageUrl: "/uploads/updated.jpg",
      caption: "Updated",
    };
    GalleryImage.findOneAndUpdate.mockResolvedValueOnce(fakeUpdated);

    const res = await request(app)
      .put(`/gallery/${vendorId}/img5`)
      .send({ caption: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.caption).toBe("Updated");
  });

  it("should return 404 if updating non-existing image", async () => {
    GalleryImage.findOneAndUpdate.mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/gallery/${vendorId}/doesNotExist`)
      .send({ caption: "Nope" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Gallery image not found");
  });

  it("should delete a gallery image", async () => {
    const fakeDeleted = { _id: "img6", vendorId };
    GalleryImage.findOneAndDelete.mockResolvedValueOnce(fakeDeleted);

    const res = await request(app).delete(`/gallery/${vendorId}/img6`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gallery image deleted");
  });

  it("should return 404 when deleting non-existing image", async () => {
    GalleryImage.findOneAndDelete.mockResolvedValueOnce(null);

    const res = await request(app).delete(`/gallery/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Gallery image not found");
  });
});
