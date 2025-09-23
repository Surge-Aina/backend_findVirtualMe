const request = require("supertest");
const app = require("../testapp");
const mongoose = require("mongoose");

// Mock Review model
jest.mock("../models/Review", () => {
  const mockReview = jest.fn(function (data) {
    Object.assign(this, data);
    this.save = jest.fn();
  });

  mockReview.find = jest.fn();
  mockReview.findByIdAndUpdate = jest.fn();
  mockReview.findByIdAndDelete = jest.fn();

  return mockReview;
});

const Review = require("../models/Review");

describe("Review API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all reviews", async () => {
    const fakeReviews = [
      { _id: "r1", vendorId, name: "Alice", feedback: "Great!", rating: 5 },
    ];
    Review.find.mockResolvedValueOnce(fakeReviews);

    const res = await request(app).get(`/review/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Alice");
    expect(Review.find).toHaveBeenCalledWith({ vendorId });
  });

  it("should create a new review", async () => {
    const fakeSaved = {
      _id: "r2",
      vendorId,
      name: "Bob",
      feedback: "Good food",
      rating: 4,
    };

    Review.mockImplementationOnce(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(fakeSaved);
    });

    const res = await request(app)
      .post(`/review/${vendorId}`)
      .send({ name: "Bob", feedback: "Good food", rating: 4 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Bob");
  });

  it("should update an existing review", async () => {
    const fakeUpdated = {
      _id: "r3",
      vendorId,
      name: "Charlie",
      feedback: "Updated review",
      rating: 3,
    };
    Review.findByIdAndUpdate.mockResolvedValueOnce(fakeUpdated);

    const res = await request(app)
      .put(`/review/${vendorId}/r3`)
      .send({ feedback: "Updated review", rating: 3 });

    expect(res.status).toBe(200);
    expect(res.body.feedback).toBe("Updated review");
  });

  it("should return 404 if updating non-existing review", async () => {
    Review.findByIdAndUpdate.mockResolvedValueOnce(null);

    const res = await request(app)
      .put(`/review/${vendorId}/doesNotExist`)
      .send({ feedback: "Does not exist" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Review not found");
  });

  it("should delete a review", async () => {
    const fakeDeleted = { _id: "r4", vendorId };
    Review.findByIdAndDelete.mockResolvedValueOnce(fakeDeleted);

    const res = await request(app).delete(`/review/${vendorId}/r4`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Review deleted");
  });

  it("should return 404 when deleting non-existing review", async () => {
    Review.findByIdAndDelete.mockResolvedValueOnce(null);

    const res = await request(app).delete(`/review/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Review not found");
  });
});
