const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const router = require("../guestAdminPanel.routes");
const controller = require("../guestAdminPanel.controller");
const User = require("../../../../shared/models/User");

// Mock the controller
jest.mock("../guestAdminPanel.controller");

const app = express();
app.use(express.json());
app.use("/api/admin", router);

describe("GuestAdminPanel Routes", () => {
  let token;

  beforeEach(async () => {
    jest.clearAllMocks();
    const stamp = `${Date.now()}_${Math.random()}`;
    const user = await User.create({
      email: `owner_${stamp}@example.com`,
      username: `owner_${stamp}`,
      password: "password123",
      userKey: `key_${stamp}`,
      practiceId: `practice_${stamp}`,
      role: "customer",
    });
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  describe("GET /users", () => {
    it("rejects unauthenticated list requests", async () => {
      const res = await request(app).get("/api/admin/users");
      expect(res.statusCode).toBe(401);
      expect(controller.getAllUsers).not.toHaveBeenCalled();
    });

    it("should route to getAllUsers controller", async () => {
      controller.getAllUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .query({ portfolioId: "test-123" });

      expect(res.statusCode).toBe(200);
      expect(controller.getAllUsers).toHaveBeenCalledTimes(1);
    });

    it("should accept query parameters", async () => {
      controller.getAllUsers.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          portfolioId: req.query.portfolioId 
        });
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .query({ portfolioId: "portfolio-456" });

      expect(res.statusCode).toBe(200);
      expect(res.body.portfolioId).toBe("portfolio-456");
    });

    it("should work without query parameters", async () => {
      controller.getAllUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(controller.getAllUsers).toHaveBeenCalled();
    });

    it("rejects POST without auth", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .send({});

      // Auth middleware short-circuits with 401 when no token is present.
      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT /users/:id", () => {
    it("rejects unauthenticated updates", async () => {
      const res = await request(app)
        .put("/api/admin/users/user123")
        .send({ name: "Updated Name" });

      expect(res.statusCode).toBe(401);
      expect(controller.editUser).not.toHaveBeenCalled();
    });

    it("should route to editUser controller", async () => {
      controller.editUser.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: { _id: req.params.id, ...req.body } 
        });
      });

      const res = await request(app)
        .put("/api/admin/users/user123")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Name" });

      expect(res.statusCode).toBe(200);
      expect(controller.editUser).toHaveBeenCalledTimes(1);
    });

    it("should pass userId from URL params", async () => {
      controller.editUser.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          userId: req.params.id 
        });
      });

      const res = await request(app)
        .put("/api/admin/users/user456")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Test" });

      expect(res.statusCode).toBe(200);
      expect(res.body.userId).toBe("user456");
    });

    it("should pass request body to controller", async () => {
      controller.editUser.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          updatedData: req.body 
        });
      });

      const updateData = {
        name: "John Doe",
        email: "john@test.com",
        phone: "123-456-7890"
      };

      const res = await request(app)
        .put("/api/admin/users/user789")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.updatedData).toEqual(updateData);
    });

    it("should not accept GET method", async () => {
      const res = await request(app).get("/api/admin/users/user123");

      expect(res.statusCode).toBe(404);
    });

    it("should not accept POST method", async () => {
      const res = await request(app)
        .post("/api/admin/users/user123")
        .send({ name: "Test" });

      expect(res.statusCode).toBe(404);
    });

    it("should not accept DELETE method", async () => {
      const res = await request(app).delete("/api/admin/users/user123");

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Route existence", () => {
    it("should have GET /users route", () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);

      expect(routes).toContain("/users");
    });

    it("should have PUT /users/:id route", () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);

      expect(routes).toContain("/users/:id");
    });

    it("should expose POST /users for owner-driven creation", () => {
      const route = router.stack
        .filter((layer) => layer.route)
        .find((layer) => layer.route.path === "/users" && layer.route.methods.post);
      expect(route).toBeDefined();
    });

    it("should expose activity endpoints", () => {
      const paths = router.stack
        .filter((layer) => layer.route)
        .map((layer) => layer.route.path);
      expect(paths).toContain("/activities");
      expect(paths).toContain("/activities/:id");
    });
  });

  describe("Invalid routes", () => {
    it("should return 404 for non-existent routes", async () => {
      const res = await request(app).get("/api/admin/nonexistent");

      expect(res.statusCode).toBe(404);
    });

    it("should return 404 for wrong path", async () => {
      const res = await request(app).get("/api/admin/getUsers");

      expect(res.statusCode).toBe(404);
    });
  });
});