const request = require("supertest");
const app = require("../../../../testapp");
const mongoose = require("mongoose");
const TaggedImage = require("../../../../models/localFoodVendor/TaggedImage");

describe("TaggedImage API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    TaggedImage.findOne = jest.fn();
    TaggedImage.find = jest.fn();
    TaggedImage.prototype.save = jest.fn();
  });

  it("should upload a new image", async () => {
    const fakeSaved = {
      _id: "img1",
      vendorId,
      imageUrl: "/uploads/test.jpg",
      tags: [],
    };
    TaggedImage.prototype.save.mockResolvedValueOnce(fakeSaved);

    const res = await request(app)
      .post(`/tagged-image/${vendorId}/upload`)
      .attach("image", Buffer.from("fake"), "test.jpg");

    expect(res.status).toBe(200); // controller uses res.json(), not 201
    expect(res.body.imageUrl).toBe("/uploads/test.jpg");
  });

  it("should add a tag to an existing image", async () => {
    const fakeImage = {
      _id: "img2",
      vendorId,
      tags: [],
      save: jest.fn().mockResolvedValue(),
    };
    TaggedImage.findOne.mockResolvedValueOnce(fakeImage);

    const res = await request(app)
      .post(`/tagged-image/${vendorId}/img2/tags`)
      .send({ x: 10, y: 20, label: "Cheese", menuItemId: "menu1" });

    expect(res.status).toBe(200);
    expect(fakeImage.tags.length).toBe(1);
    expect(TaggedImage.findOne).toHaveBeenCalledWith({ _id: "img2", vendorId });
  });

  it("should update a tag", async () => {
    const fakeImage = {
      _id: "img3",
      vendorId,
      tags: [{ x: 1, y: 1, label: "Old" }],
      save: jest.fn().mockResolvedValue(),
    };
    TaggedImage.findOne.mockResolvedValueOnce(fakeImage);

    const res = await request(app)
      .put(`/tagged-image/${vendorId}/img3/tags/0`)
      .send({ x: 2, y: 2, label: "New", menuItemId: "menu2" });

    expect(res.status).toBe(200);
    expect(fakeImage.tags[0].label).toBe("New");
  });

  it("should delete a tag", async () => {
    const fakeImage = {
      _id: "img4",
      vendorId,
      tags: [{ x: 1, y: 1, label: "DeleteMe" }],
      save: jest.fn().mockResolvedValue(),
    };
    TaggedImage.findOne.mockResolvedValueOnce(fakeImage);

    const res = await request(app).delete(`/tagged-image/${vendorId}/img4/tags/0`);

    expect(res.status).toBe(200);
    expect(fakeImage.tags.length).toBe(0);
  });

  it("should fetch a single tagged image", async () => {
    const fakeImage = { _id: "img5", vendorId, tags: [] };
    TaggedImage.findOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(fakeImage),
    });

    const res = await request(app).get(`/tagged-image/${vendorId}/img5`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe("img5");
  });

  it("should fetch all tagged images", async () => {
    const fakeImages = [{ _id: "img6", vendorId, tags: [] }];
    TaggedImage.find.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(fakeImages),
    });

    const res = await request(app).get(`/tagged-image/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
