require("../../setup");
jest.unmock("multer");

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");

//model mock
jest.mock("../../models/localFoodVendor/Review", () => {
  const dataStore = [];

  class MockReview {
    constructor(data) {
      Object.assign(this, data);
      this._id = this._id || `${dataStore.length + 1}`;
    }

    async save() {
      dataStore.push(this);
      return this;
    }

    static async find(filter = {}) {
      return dataStore.filter((r) =>
        Object.keys(filter).every((k) => r[k] === filter[k])
      );
    }

    static async findOneAndUpdate(filter = {}, updates = {}, options = {}) {
      const review = dataStore.find((r) =>
        Object.keys(filter).every((k) => r[k] === filter[k])
      );
      if (!review) return null;
      Object.assign(review, updates);
      return options.new ? review : null;
    }

    static async findOneAndDelete(filter = {}) {
      const index = dataStore.findIndex((r) =>
        Object.keys(filter).every((k) => r[k] === filter[k])
      );
      if (index === -1) return null;
      const [deleted] = dataStore.splice(index, 1);
      return deleted;
    }

    static async deleteMany() {
      dataStore.length = 0;
    }
  }

  return MockReview;
});

const Review = require("../../models/localFoodVendor/Review");

//express setup
const reviewRoutes = require("../../routes/localFoodVendor/reviewRoutes");
const app = express();
app.use(express.json());
app.use("/review", reviewRoutes);

//TEsts
describe("Review API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  afterEach(async () => {
    jest.clearAllMocks();
    await Review.deleteMany();
  });

  it("should fetch all reviews for a vendor", async () => {
    await Promise.all([
      new Review({
        vendorId,
        name: "Alice",
        feedback: "Great!",
        rating: 5,
      }).save(),
      new Review({ vendorId, name: "Bob", feedback: "Good", rating: 4 }).save(),
    ]);

    const res = await request(app).get(`/review/${vendorId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[1].feedback).toBe("Good");
  });

  it("should create a new review", async () => {
    const res = await request(app).post(`/review/${vendorId}`).send({
      name: "Charlie",
      feedback: "Delicious food!",
      rating: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Charlie");
    expect(res.body.rating).toBe(5);
  });

  it("should update an existing review", async () => {
    const review = new Review({
      vendorId,
      name: "Diana",
      feedback: "Okay",
      rating: 3,
    });
    await review.save();

    const res = await request(app)
      .put(`/review/${vendorId}/${review._id}`)
      .send({ feedback: "Improved feedback", rating: 4 });

    expect(res.status).toBe(200);
    expect(res.body.feedback).toBe("Improved feedback");
    expect(res.body.rating).toBe(4);
  });

  it("should return 404 if updating non-existing review", async () => {
    const res = await request(app)
      .put(`/review/${vendorId}/doesNotExist`)
      .send({ feedback: "Does not exist" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Review not found");
  });

  it("should delete an existing review", async () => {
    const review = new Review({
      vendorId,
      name: "Eve",
      feedback: "Tasty meals",
      rating: 5,
    });
    await review.save();

    const res = await request(app).delete(`/review/${vendorId}/${review._id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Review deleted");
  });

  it("should return 404 when deleting non-existing review", async () => {
    const res = await request(app).delete(`/review/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Review not found");
  });
});
