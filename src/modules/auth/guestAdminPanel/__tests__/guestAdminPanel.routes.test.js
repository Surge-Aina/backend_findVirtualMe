const request = require("supertest");
const express = require("express");
const router = require("../guestAdminPanel.routes");
const controller = require("../guestAdminPanel.controller");

// Mock the controller
jest.mock("../guestAdminPanel.controller");

const app = express();
app.use(express.json());
app.use("/api/admin", router);

describe("GuestAdminPanel Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /getAllUsers", () => {
    it("should route to getAllUsers controller", async () => {
      controller.getAllUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const res = await request(app)
        .get("/api/admin/getAllUsers")
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
        .get("/api/admin/getAllUsers")
        .query({ portfolioId: "portfolio-456" });

      expect(res.statusCode).toBe(200);
      expect(res.body.portfolioId).toBe("portfolio-456");
    });

    it("should work without query parameters", async () => {
      controller.getAllUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const res = await request(app).get("/api/admin/getAllUsers");

      expect(res.statusCode).toBe(200);
      expect(controller.getAllUsers).toHaveBeenCalled();
    });

    it("should not accept POST method", async () => {
      const res = await request(app)
        .post("/api/admin/getAllUsers")
        .send({});

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /editUser/:id", () => {
    it("should route to editUser controller", async () => {
      controller.editUser.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: { _id: req.params.id, ...req.body } 
        });
      });

      const res = await request(app)
        .put("/api/admin/editUser/user123")
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
        .put("/api/admin/editUser/user456")
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
        .put("/api/admin/editUser/user789")
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.updatedData).toEqual(updateData);
    });

    it("should not accept GET method", async () => {
      const res = await request(app).get("/api/admin/editUser/user123");

      expect(res.statusCode).toBe(404);
    });

    it("should not accept POST method", async () => {
      const res = await request(app)
        .post("/api/admin/editUser/user123")
        .send({ name: "Test" });

      expect(res.statusCode).toBe(404);
    });

    it("should not accept DELETE method", async () => {
      const res = await request(app).delete("/api/admin/editUser/user123");

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Route existence", () => {
    it("should have exactly 2 routes defined", () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      expect(routes).toHaveLength(2);
    });

    it("should have GET /getAllUsers route", () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);

      expect(routes).toContain("/getAllUsers");
    });

    it("should have PUT /editUser/:id route", () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);

      expect(routes).toContain("/editUser/:id");
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