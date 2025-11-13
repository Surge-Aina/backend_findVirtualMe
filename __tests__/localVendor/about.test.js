const request = require("supertest");
const app = require("../../../../testapp");
const mongoose = require("mongoose");
const About = require("../../../../models/localFoodVendor/About");

beforeEach(() => {
  jest.clearAllMocks();
  About.findOneAndUpdate = jest.fn();
  About.findOne = jest.fn();
  About.findByIdAndDelete = jest.fn();
});

describe("About API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch about content for a vendor", async () => {
    const fakeAbout = {
      _id: "about1",
      vendorId,
      banner: { title: "About Us", description: "We sell food" },
      contentBlocks: [{ heading: "Our Story" }],
      gridImages: ["/uploads/img1.jpg"],
    };
    About.findOne.mockResolvedValueOnce(fakeAbout);

    const res = await request(app).get(`/about/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body.banner.title).toBe("About Us");
    expect(About.findOne).toHaveBeenCalledWith({ vendorId });
  });

  it("should create or upsert about content", async () => {
    const fakeUpdated = {
      _id: "about2",
      vendorId,
      banner: { title: "New Title", description: "Fresh description" },
      contentBlocks: [{ heading: "Block 1" }],
      gridImages: ["/uploads/img1.jpg"],
    };
    About.findOneAndUpdate.mockResolvedValueOnce(fakeUpdated);

    const res = await request(app)
      .post(`/about/${vendorId}`)
      .send({ title: "New Title", description: "Fresh description" });

    expect(res.status).toBe(201);
    expect(res.body.banner.title).toBe("New Title");
    expect(About.findOneAndUpdate).toHaveBeenCalledWith(
      { vendorId },
      expect.any(Object),
      { new: true, upsert: true }
    );
  });

  it("should update about content", async () => {
    const fakeSaved = {
      _id: "about3",
      vendorId,
      banner: {},
      contentBlocks: [],
      gridImages: [],
      save: jest.fn().mockResolvedValue({
        _id: "about3",
        vendorId,
        banner: { title: "Updated", description: "Changed" },
        contentBlocks: [],
        gridImages: [],
      }),
    };

    About.findOne.mockResolvedValueOnce(fakeSaved);

    const res = await request(app)
      .put(`/about/${vendorId}`)
      .send({ title: "Updated", description: "Changed" });

    expect(res.status).toBe(200);
    expect(res.body.banner.title).toBe("Updated");
    expect(About.findOne).toHaveBeenCalledWith({ vendorId });
  });

  it("should delete about content", async () => {
    const fakeDeleted = { _id: "about4", vendorId };
    About.findByIdAndDelete.mockResolvedValueOnce(fakeDeleted);

    const res = await request(app).delete(`/about/${vendorId}/about4`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("About content deleted");
    expect(About.findByIdAndDelete).toHaveBeenCalledWith({
      _id: "about4",
      vendorId,
    });
  });

  it("should return 404 when deleting non-existing about content", async () => {
    About.findByIdAndDelete.mockResolvedValueOnce(null);

    const res = await request(app).delete(`/about/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("About content not found");
  });
});
