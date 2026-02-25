require("../../setup");
jest.unmock("multer");

// Silence console output during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// Mock S3 service (shared reference)
jest.mock("../../services/s3Service", () => ({
  uploadToS3: jest.fn(),
  deleteFromS3: jest.fn(),
}));

// Mock multer middleware
jest.mock("../../utils/multer", () => ({
  single: () => (req, res, next) => next(),
  fields: () => (req, res, next) => next(),
  array: () => (req, res, next) => next(),
}));

// Mock MenuItems model (in-memory mock)
jest.mock("../../models/localFoodVendor/MenuItems", () => {
  const dataStore = [];

  class MockMenuItem {
    constructor(data) {
      Object.assign(this, data);
      this._id = this._id || `${dataStore.length + 1}`;
    }

    async save() {
      const existing = dataStore.find((d) => d._id === this._id);
      if (!existing) dataStore.push(this);
      return this;
    }

    static async find(filter = {}) {
      return dataStore.filter((item) =>
        Object.keys(filter).every((k) => item[k] === filter[k])
      );
    }

    static async distinct(field, filter = {}) {
      const items = await this.find(filter);
      return [...new Set(items.map((i) => i[field]).filter(Boolean))];
    }

    static async findOne(filter = {}) {
      return dataStore.find((item) =>
        Object.keys(filter).every((k) => item[k] === filter[k])
      );
    }

    static async findOneAndDelete(filter = {}) {
      const index = dataStore.findIndex((item) =>
        Object.keys(filter).every((k) => item[k] === filter[k])
      );
      if (index === -1) return null;
      const [deleted] = dataStore.splice(index, 1);
      return deleted;
    }

    static async deleteMany() {
      dataStore.length = 0;
    }
  }

  return MockMenuItem;
});

// Imports
const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const menuRoutes = require("../../routes/localFoodVendor/menuRoutes");
const MenuItem = require("../../models/localFoodVendor/MenuItems");
const s3Service = require("../../services/s3Service");

// Express test app
const app = express();
app.use(express.json());
app.use("/menu", menuRoutes);

// Test Suite
describe("Menu API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  // Reset mocks before each test
  beforeEach(() => {
    s3Service.uploadToS3.mockReset().mockResolvedValue({
      url: "https://mock-s3.com/item.jpg",
      key: "mock-key",
    });

    s3Service.deleteFromS3.mockReset().mockResolvedValue(true);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await MenuItem.deleteMany();
  });

  describe("Create Menu Item", () => {
    it("should create a new menu item without image", async () => {
      const res = await request(app)
        .post(`/menu/${vendorId}`)
        .send({ name: "Pizza", price: 10, category: "Italian" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Pizza");
      expect(res.body.category).toBe("Italian");
    });

    it("should create menu item with image upload", async () => {
      s3Service.uploadToS3.mockResolvedValue({
        url: "https://mock-s3.com/uploaded.jpg",
        key: "uploaded-key",
      });

      const res = await request(app)
        .post(`/menu/${vendorId}`)
        .attach("image", Buffer.from("fake-image"), "test.jpg")
        .field("name", "Noodles")
        .field("price", "10");

      expect(res.status).toBe(201);
      expect(s3Service.uploadToS3).toHaveBeenCalledTimes(1);
      expect(res.body.imageUrl).toBe("https://mock-s3.com/uploaded.jpg");
      expect(res.body.imageKey).toBe("uploaded-key");
    });

    it("should return 400 when creation fails", async () => {
      jest
        .spyOn(MenuItem.prototype, "save")
        .mockRejectedValue(new Error("fail"));

      const res = await request(app)
        .post(`/menu/${vendorId}`)
        .send({ name: "Bad", price: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Failed to create menu item");
    });
  });

  describe("Get Menu Items", () => {
    it("should fetch menu items by category", async () => {
      await new MenuItem({
        vendorId,
        name: "Burger",
        category: "Fast Food",
      }).save();

      const res = await request(app).get(
        `/menu/${vendorId}?category=Fast Food`
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("should return 500 if fetching items fails", async () => {
      jest.spyOn(MenuItem, "find").mockRejectedValue(new Error("fail"));

      const res = await request(app).get(`/menu/${vendorId}`);
      expect(res.status).toBe(500);
    });
  });

  describe("Get Categories", () => {
    it("should fetch unique categories including 'All'", async () => {
      await new MenuItem({
        vendorId,
        name: "Cake",
        category: "Desserts",
      }).save();
      await new MenuItem({
        vendorId,
        name: "Fries",
        category: "Fast Food",
      }).save();

      const res = await request(app).get(`/menu/${vendorId}/categories`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.arrayContaining(["All", "Desserts", "Fast Food"])
      );
    });

    it("should return 500 if fetching categories fails", async () => {
      jest.spyOn(MenuItem, "distinct").mockRejectedValue(new Error("fail"));

      const res = await request(app).get(`/menu/${vendorId}/categories`);
      expect(res.status).toBe(500);
    });
  });

  // update
  describe("Update Menu Item", () => {
    it("should update an existing menu item", async () => {
      const item = await new MenuItem({
        vendorId,
        name: "Pasta",
        price: 9,
      }).save();

      const res = await request(app)
        .put(`/menu/${vendorId}/${item._id}`)
        .send({ price: 12 });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe(12);
    });

    it("should return 404 if item does not exist", async () => {
      const res = await request(app)
        .put(`/menu/${vendorId}/doesNotExist`)
        .send({ price: 12 });

      expect(res.status).toBe(404);
    });

    it("should replace menu image and delete old image", async () => {
      const item = await new MenuItem({
        vendorId,
        name: "Old",
        imageUrl: "https://old.com/old.jpg",
        imageKey: "old-key",
      }).save();

      s3Service.uploadToS3.mockResolvedValue({
        url: "https://mock-s3.com/new.jpg",
        key: "new-key",
      });

      const res = await request(app)
        .put(`/menu/${vendorId}/${item._id}`)
        .attach("image", Buffer.from("fake"), "new.jpg");

      expect(res.status).toBe(200);
      expect(s3Service.deleteFromS3).toHaveBeenCalledWith("old-key");
      expect(res.body.imageKey).toBe("new-key");
    });

    it("should return 400 when update fails", async () => {
      jest.spyOn(MenuItem, "findOne").mockRejectedValue(new Error("boom"));

      const res = await request(app)
        .put(`/menu/${vendorId}/123`)
        .send({ price: 9 });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------
  // DELETE
  // --------------------------
  describe("Delete Menu Item", () => {
    it("should delete a menu item successfully", async () => {
      const item = await new MenuItem({
        vendorId,
        name: "ToDelete",
        price: 15,
        imageUrl: "https://mock-s3.com/item.jpg",
        imageKey: "mock-key",
      }).save();

      const res = await request(app).delete(`/menu/${vendorId}/${item._id}`);
      expect(res.status).toBe(200);
    });

    it("should delete using fallback keyFromUrl when key is missing", async () => {
      const item = await new MenuItem({
        vendorId,
        name: "URLOnly",
        imageUrl: "https://mock-s3.com/a/b/c.png",
      }).save();

      const res = await request(app).delete(`/menu/${vendorId}/${item._id}`);

      expect(res.status).toBe(200);
      expect(s3Service.deleteFromS3).toHaveBeenCalledWith("a/b/c.png");
    });

    it("should return 404 if item not found", async () => {
      const res = await request(app).delete(`/menu/${vendorId}/doesNotExist`);
      expect(res.status).toBe(404);
    });

    it("should return 500 when delete crashes", async () => {
      jest
        .spyOn(MenuItem, "findOneAndDelete")
        .mockRejectedValue(new Error("crash"));

      const res = await request(app).delete(`/menu/${vendorId}/123`);
      expect(res.status).toBe(500);
    });
  });
});
