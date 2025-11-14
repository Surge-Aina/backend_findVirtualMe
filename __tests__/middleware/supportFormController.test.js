const express = require("express");
const request = require("supertest");

const supportFormRoutes = require("../../../../routes/supportFormRoutes");
const SupportForm = require("../../../../models/supportForm/SupportForm");
const Counter = require("../../../../models/supportForm/Counter");

const app = express();
app.use(express.json());
app.use("/api/support-form", supportFormRoutes);

describe("SupportForm API", () => {
  describe("POST /api/support-form - Create support form", () => {
    test("should successfully create a support form", async () => {
      const payload = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        requestType: "Technical Issue",
        portfolioId: "portfolio123",
        message: "I need technical support"
      };
      
      const res = await request(app)
        .post("/api/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload.name);
      expect(res.body.email).toBe(payload.email);
      expect(res.body.ticketID).toMatch(/^T\d{5}$/);
    });

    test("should auto-generate unique ticketID", async () => {
      const payload = {
        name: "Jane Smith",
        email: "jane@example.com",
        message: "Test message"
      };

      const res = await request(app)
        .post("/api/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.ticketID).toBe("T00001");
    });

    test("should generate incremental ticketIDs for multiple forms", async () => {
      const res1 = await request(app)
        .post("/api/support-form")
        .send({
          name: "User 1",
          email: "user1@example.com",
          message: "First issue"
        });

      const res2 = await request(app)
        .post("/api/support-form")
        .send({
          name: "User 2",
          email: "user2@example.com",
          message: "Second issue"
        });

      expect(res1.body.ticketID).toBe("T00001");
      expect(res2.body.ticketID).toBe("T00002");
    });

    test("should reject requests with missing required fields", async () => {
      const res = await request(app)
        .post("/api/support-form")
        .send({ name: "John Doe" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/support-form - Get all tickets", () => {
    test("should return all tickets", async () => {
      await SupportForm.create({
        name: "User 1",
        email: "user1@example.com",
        message: "Issue 1",
        ticketID: "T00001"
      });

      const res = await request(app).get("/api/support-form");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test("should return empty array when no tickets exist", async () => {
      const res = await request(app).get("/api/support-form");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("PUT /api/support-form/:ticketID - Update ticket status", () => {
    beforeEach(async () => {
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    test("should successfully update status to 'In Progress'", async () => {
      const res = await request(app)
        .put("/api/support-form/T00001")
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("In Progress");
      expect(res.body.completionTime).toBeNull();
    });

    test("should successfully update status to 'Completed'", async () => {
      const res = await request(app)
        .put("/api/support-form/T00001")
        .send({ status: "Completed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Completed");
      expect(res.body.completionTime).toBeDefined();
    });

    test("should reject invalid status values", async () => {
      const res = await request(app)
        .put("/api/support-form/T00001")
        .send({ status: "InvalidStatus" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/support-form/:ticketID - Delete ticket", () => {
    beforeEach(async () => {
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    test("should successfully delete existing ticket", async () => {
      const res = await request(app).delete("/api/support-form/T00001");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("POST /api/support-form/:ticketID/replies - Add reply", () => {
    beforeEach(async () => {
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    test("should successfully add a reply", async () => {
      const res = await request(app)
        .post("/api/support-form/T00001/replies")
        .send({ message: "Admin reply" });

      expect(res.status).toBe(200);
      expect(res.body.replies).toContain("Admin reply");
    });

    test("should reject empty replies", async () => {
      const res = await request(app)
        .post("/api/support-form/T00001/replies")
        .send({ message: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/support-form/with-email - Submit with email", () => {
    test("should create form and handle email notifications", async () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        phone: "+1234567890",
        requestType: "Technical",
        message: "Test issue"
      };

      const res = await request(app)
        .post("/api/support-form/with-email")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload.name);
    });

    test('should require all required fields', async () => {
      const res = await request(app)
        .post("/api/support-form/with-email")
        .send({ name: "Test User" });

      expect(res.status).toBe(400);
    });
  });
});