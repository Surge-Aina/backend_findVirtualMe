const request = require("supertest");
const app = require("../testapp");
const mongoose = require("mongoose");
const Banner = require("../models/Banner");

beforeEach(() => {
  jest.clearAllMocks();
  Banner.find = jest.fn();
  Banner.findOneAndUpdate = jest.fn();
  Banner.findOneAndDelete = jest.fn();
});

describe("Banner API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all banners for a vendor", async () => {
    const fakeBanners = [
      { _id: "banner1", vendorId, title: "Welcome", description: "Fresh food" },
      { _id: "banner2", vendorId, title: "Deals", description: "Discounts" },
    ];
    Banner.find.mockResolvedValueOnce(fakeBanners);

    const res = await request(app).get(`/banner/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(Banner.find).toHaveBeenCalledWith({ vendorId });
  });

  it("should create a new banner", async () => {
    const payload = { title: "Grand Opening", description: "Big discounts" };

    // prepare fake saved object
    const fakeSaved = {
      _id: "banner3",
      vendorId,
      ...payload,
      shape: "fullscreen",
    };

    Banner.mockImplementationOnce((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(fakeSaved),
    }));

    const res = await request(app).post(`/banner/${vendorId}`).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Grand Opening");
  });

  it("should update an existing banner", async () => {
    const fakeUpdated = {
      _id: "banner4",
      vendorId,
      title: "Updated Title",
      description: "Updated Description",
      shape: "blob",
    };
    Banner.findOneAndUpdate.mockResolvedValueOnce(fakeUpdated);

    const res = await request(app)
      .put(`/banner/${vendorId}/banner4`)
      .send({ title: "Updated Title", description: "Updated Description" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(Banner.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "banner4", vendorId },
      expect.objectContaining({ title: "Updated Title" }),
      { new: true }
    );
  });

  it("should return 404 if updating non-existing banner", async () => {
    Banner.findOneAndUpdate.mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/banner/${vendorId}/doesNotExist`)
      .send({ title: "No Banner" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");
  });

  it("should delete a banner", async () => {
    const fakeDeleted = { _id: "banner5", vendorId };
    Banner.findOneAndDelete.mockResolvedValueOnce(fakeDeleted);

    const res = await request(app).delete(`/banner/${vendorId}/banner5`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Banner deleted");
    expect(Banner.findOneAndDelete).toHaveBeenCalledWith({
      _id: "banner5",
      vendorId,
    });
  });

  it("should return 404 when deleting non-existing banner", async () => {
    Banner.findOneAndDelete.mockResolvedValueOnce(null);

    const res = await request(app).delete(`/banner/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Banner not found");
  });
});
