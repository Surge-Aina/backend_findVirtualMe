const express = require("express");
const request = require("supertest");

// Import the controller functions directly
const contactController = require("../../contact/aiPortfolioCreator.controller");

// Mock the service
const svc = require("../../contact/aiPortfolioCreator.service");
jest.mock("../../contact/aiPortfolioCreator.service");

const app = express();
app.use(express.json());

// Setup routes for testing
app.get("/contacts", contactController.listContacts);
app.post("/contacts", contactController.createContact);
app.patch("/contacts/bulk", contactController.bulkUpdate);
app.patch("/contacts/:id", contactController.updateContact);

describe("Contact Routes / Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /contacts", () => {
    test("should return list of contacts", async () => {
      svc.listContacts.mockResolvedValue([{ id: "1", userName: "Alice" }]);

      const res = await request(app).get("/contacts").query({ projectId: "default" });

      expect(res.status).toBe(200);
      expect(res.body[0].userName).toBe("Alice");
      expect(svc.listContacts).toHaveBeenCalledWith({
        projectId: "default",
        userName: undefined,
      });
    });

    test("should handle service error", async () => {
      svc.listContacts.mockRejectedValue(new Error("Read failed"));

      const res = await request(app).get("/contacts");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Read failed");
    });
  });

  describe("POST /contacts", () => {
    test("should create a contact", async () => {
      svc.createContact.mockResolvedValue({ id: "1", userName: "Bob" });

      const res = await request(app)
        .post("/contacts")
        .send({ userName: "Bob", contact: { email: "a@b.com" } });

      expect(res.status).toBe(201);
      expect(res.body.userName).toBe("Bob");
    });

    test("should return 400 if required fields missing", async () => {
      svc.createContact.mockRejectedValue(new Error("userName and contact required"));

      const res = await request(app).post("/contacts").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test("should return 500 for other errors", async () => {
      svc.createContact.mockRejectedValue(new Error("Unexpected"));

      const res = await request(app)
        .post("/contacts")
        .send({ userName: "Bob", contact: { email: "a@b.com" } });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Unexpected");
    });
  });

  describe("PATCH /contacts/:id", () => {
    test("should update a contact", async () => {
      svc.updateContact.mockResolvedValue({ id: "1", userName: "Charlie" });

      const res = await request(app).patch("/contacts/1").send({ userName: "Charlie" });

      expect(res.status).toBe(200);
      expect(res.body.userName).toBe("Charlie");
    });

    test("should return 404 if contact not found", async () => {
      svc.updateContact.mockRejectedValue(new Error("Not found"));

      const res = await request(app).patch("/contacts/123").send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Not found");
    });

    test("should return 500 for other errors", async () => {
      svc.updateContact.mockRejectedValue(new Error("Fail"));

      const res = await request(app).patch("/contacts/1").send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Fail");
    });
  });

  describe("PATCH /contacts/bulk", () => {
    test("should bulk update contacts (200)", async () => {
      const updates = [{ id: "1", userName: "Alice" }];
      svc.bulkUpdate.mockResolvedValue([{ id: "1", userName: "Alice" }]);

      const res = await request(app).patch("/contacts/bulk").send(updates);

      console.log("test bulk update output (200):", res.body);

      expect(res.status).toBe(200);
      expect(res.body[0].userName).toBe("Alice");
    });

    test("should return 400 if array missing", async () => {
      svc.bulkUpdate.mockRejectedValue(new Error("Array of updates required"));

      const res = await request(app).patch("/contacts/bulk").send({});

      console.log("test bulk update missing array output (400):", res.body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test("should return 400 if empty array sent", async () => {
      svc.bulkUpdate.mockRejectedValue(new Error("Array of updates required"));

      const res = await request(app).patch("/contacts/bulk").send([]);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test("should return 500 for other errors", async () => {
      const updates = [{ id: "1", userName: "Alice" }];
      svc.bulkUpdate.mockRejectedValue(new Error("Database error"));

      const res = await request(app).patch("/contacts/bulk").send(updates);

      console.log("test bulk update fail output (500):", res.body);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Database error");
    });
  });
});
