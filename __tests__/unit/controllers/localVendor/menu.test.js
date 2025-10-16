const request = require("supertest");
const app = require("../../../../testapp");
const mongoose = require("mongoose");

// Import the mocked MenuItems model from setup.js
const MenuItems = require("../../../../models/localFoodVendor/MenuItems");

describe("Menu API (mocked)", () => {
  const vendorId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new menu item", async () => {
    const res = await request(app)
      .post(`/menu/${vendorId}`)
      .send({ name: "Pizza", price: 10, category: "Italian" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Pizza");
  });

  it("should fetch menu items by category", async () => {
    const fakeItems = [
      { _id: "mockId2", vendorId, name: "Burger", category: "Fast Food" },
    ];
    MenuItems.find.mockResolvedValueOnce(fakeItems);

    const res = await request(app).get(`/menu/${vendorId}?category=Fast Food`);

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Burger");
    expect(MenuItems.find).toHaveBeenCalledWith({
      vendorId,
      category: "Fast Food",
    });
  });

  it("should fetch unique categories", async () => {
    MenuItems.distinct = jest.fn().mockResolvedValueOnce(["Fast Food", "Desserts"]);

    const res = await request(app).get(`/menu/${vendorId}/categories`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining(["All", "Fast Food", "Desserts"]));
    expect(MenuItems.distinct).toHaveBeenCalledWith("category", { vendorId });
  });

  it("should update an existing menu item", async () => {
    const res = await request(app).put(`/menu/${vendorId}/mockId3`).send({ price: 12 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(12);
  });

  it("should return 404 if updating non-existing item", async () => {
    const res = await request(app)
      .put(`/menu/${vendorId}/doesNotExist`)
      .send({ price: 12 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });

  it("should delete a menu item", async () => {
    const fakeDeleted = { _id: "mockId4", vendorId, name: "Pasta" };
    MenuItems.findByIdAndDelete = jest.fn().mockResolvedValueOnce(fakeDeleted);

    const res = await request(app).delete(`/menu/${vendorId}/mockId4`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deleted successfully");
    expect(MenuItems.findByIdAndDelete).toHaveBeenCalledWith({
      _id: "mockId4",
      vendorId,
    });
  });

  it("should return 404 if deleting non-existing item", async () => {
    MenuItems.findByIdAndDelete = jest.fn().mockResolvedValueOnce(null);

    const res = await request(app).delete(`/menu/${vendorId}/doesNotExist`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Item not found");
  });
});
