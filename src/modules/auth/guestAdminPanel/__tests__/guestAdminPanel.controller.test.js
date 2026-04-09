const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const controller = require("../guestAdminPanel.controller");
const guestUserService = require("../../guestLogin/guestUser.service");

// Mock the guestUserService
jest.mock("../../guestLogin/guestUser.service");

const app = express();
app.use(bodyParser.json());

// Setup routes
app.get("/admin/users", controller.getAllUsers);
app.put("/admin/users/:id", controller.editUser);

describe("GuestAdminPanel Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /admin/users - getAllUsers", () => {
    it("should get all users for a portfolio", async () => {
      const mockUsers = [
        {
          _id: "user1",
          name: "User 1",
          email: "user1@test.com",
          portfolioId: "portfolio-123",
        },
        {
          _id: "user2",
          name: "User 2",
          email: "user2@test.com",
          portfolioId: "portfolio-123",
        },
      ];

      guestUserService.getAllUsers.mockResolvedValue({
        success: true,
        data: mockUsers,
      });

      const res = await request(app)
        .get("/admin/users")
        .query({ portfolioId: "portfolio-123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(guestUserService.getAllUsers).toHaveBeenCalledWith("portfolio-123");
    });

    it("should get all users without portfolioId filter", async () => {
      const mockUsers = [
        { _id: "user1", name: "User 1", email: "user1@test.com" },
        { _id: "user2", name: "User 2", email: "user2@test.com" },
      ];

      guestUserService.getAllUsers.mockResolvedValue({
        success: true,
        data: mockUsers,
      });

      const res = await request(app).get("/admin/users");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(guestUserService.getAllUsers).toHaveBeenCalledWith(undefined);
    });

    it("should return 400 when service returns failure", async () => {
      guestUserService.getAllUsers.mockResolvedValue({
        success: false,
        message: "Failed to fetch users",
      });

      const res = await request(app)
        .get("/admin/users")
        .query({ portfolioId: "portfolio-123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Failed to fetch users");
    });

    it("should handle errors gracefully", async () => {
      guestUserService.getAllUsers.mockRejectedValue(
        new Error("Database error")
      );

      const res = await request(app)
        .get("/admin/users")
        .query({ portfolioId: "portfolio-123" });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Internal server error");
    });
  });

  describe("PUT /admin/users/:id - editUser", () => {
    it("should update user successfully", async () => {
      const mockUpdatedUser = {
        _id: "user123",
        name: "Updated Name",
        email: "user@test.com",
        phone: "123-456-7890",
      };

      guestUserService.updateUser.mockResolvedValue(mockUpdatedUser);

      const res = await request(app)
        .put("/admin/users/user123")
        .send({
          name: "Updated Name",
          phone: "123-456-7890",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User updated successfully");
      expect(res.body.data.name).toBe("Updated Name");
      expect(guestUserService.updateUser).toHaveBeenCalledWith({
        userId: "user123",
        updatedInfo: {
          name: "Updated Name",
          phone: "123-456-7890",
        },
      });
    });

    it("should update user email", async () => {
      const mockUpdatedUser = {
        _id: "user123",
        name: "User",
        email: "newemail@test.com",
      };

      guestUserService.updateUser.mockResolvedValue(mockUpdatedUser);

      const res = await request(app)
        .put("/admin/users/user123")
        .send({
          email: "newemail@test.com",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.email).toBe("newemail@test.com");
    });

    it("should update loyalty points", async () => {
      const mockUpdatedUser = {
        _id: "user123",
        name: "User",
        email: "user@test.com",
        loyaltyPoints: 150,
      };

      guestUserService.updateUser.mockResolvedValue(mockUpdatedUser);

      const res = await request(app)
        .put("/admin/users/user123")
        .send({
          loyaltyPoints: 150,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.loyaltyPoints).toBe(150);
    });

    it("should handle update errors", async () => {
      guestUserService.updateUser.mockRejectedValue(
        new Error("User not found")
      );

      const res = await request(app)
        .put("/admin/users/invalid-id")
        .send({
          name: "Updated Name",
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should handle database errors", async () => {
      guestUserService.updateUser.mockRejectedValue(
        new Error("Database connection failed")
      );

      const res = await request(app)
        .put("/admin/users/user123")
        .send({
          name: "Test",
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
  it("should return 400 with custom message when service fails", async () => {
  guestUserService.getAllUsers.mockResolvedValue({
    success: false,
    message: "Custom error message", // ✅ Test when message exists
  });

  const res = await request(app)
    .get("/admin/users")
    .query({ portfolioId: "portfolio-123" });

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toBe("Custom error message");
});

it("should return 400 with default message when service fails without message", async () => {
  guestUserService.getAllUsers.mockResolvedValue({
    success: false,
    // ✅ No message property - tests the || "Failed to fetch users" branch
  });

  const res = await request(app)
    .get("/admin/users")
    .query({ portfolioId: "portfolio-123" });

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toBe("Failed to fetch users");
});

it("should handle update errors with custom message", async () => {
  const customError = new Error("Custom error");
  customError.message = "User validation failed";
  
  guestUserService.updateUser.mockRejectedValue(customError);

  const res = await request(app)
    .put("/admin/users/user123")
    .send({ name: "Test" });

  expect(res.statusCode).toBe(500);
  expect(res.body.message).toBe("User validation failed");
});

it("should handle update errors without custom message", async () => {
  const errorWithoutMessage = {};
  errorWithoutMessage.message = ""; // Empty message
  
  guestUserService.updateUser.mockRejectedValue(errorWithoutMessage);

  const res = await request(app)
    .put("/admin/users/user123")
    .send({ name: "Test" });

  expect(res.statusCode).toBe(500);
  expect(res.body.message).toBe("Internal server error");
});
});