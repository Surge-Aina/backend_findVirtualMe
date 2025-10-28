const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const path = require("path");

// Use absolute paths
const supportFormRoutes = require(path.join(__dirname, "../../../../routes/supportFormRoutes"));
const app = express();
app.use(express.json());
app.use("/support-form", supportFormRoutes);

const SupportForm = require(path.join(__dirname, "../../../../models/supportForm/SupportForm"));
const Counter = require(path.join(__dirname, "../../../../models/supportForm/Counter"));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up all collections
  await SupportForm.deleteMany();
  await Counter.deleteMany();
});

describe("SupportForm API", () => {
  describe("POST /support-form - Create support form", () => {
    it("should successfully create a support form", async () => {
      const payload = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        requestType: "Technical Issue",
        portfolioId: "portfolio123",
        message: "I need technical support"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload.name);
      expect(res.body.email).toBe(payload.email);
      expect(res.body.phone).toBe(payload.phone);
      expect(res.body.requestType).toBe(payload.requestType);
      expect(res.body.portfolioId).toBe(payload.portfolioId);
      expect(res.body.message).toBe(payload.message);
      expect(res.body.ticketID).toMatch(/^T\d{5}$/); // Format: T00001
      expect(res.body.status).toBe("New");
      expect(res.body.priority).toBe("Normal");
      expect(res.body.replies).toEqual([]);
      expect(res.body.completionTime).toBeNull();
    });

    it("should auto-generate unique ticketID", async () => {
      const payload = {
        name: "Jane Smith",
        email: "jane@example.com",
        message: "Test message"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.ticketID).toMatch(/^T\d{5}$/);
      expect(res.body.ticketID).toBe("T00001");
    });

    it("should generate incremental ticketIDs for multiple forms", async () => {
      const payload1 = {
        name: "User 1",
        email: "user1@example.com",
        message: "First issue"
      };

      const payload2 = {
        name: "User 2",
        email: "user2@example.com",
        message: "Second issue"
      };

      const res1 = await request(app)
        .post("/support-form")
        .send(payload1);

      const res2 = await request(app)
        .post("/support-form")
        .send(payload2);

      expect(res1.body.ticketID).toBe("T00001");
      expect(res2.body.ticketID).toBe("T00002");
    });

    it("should reject requests with missing required fields", async () => {
      const payload = {
        name: "John Doe",
        // Missing email and message
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Failed to create support form");
    });

    it("should handle invalid email format", async () => {
      const payload = {
        name: "John Doe",
        email: "invalid-email",
        message: "Test message"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      // Note: Current Mongoose schema doesn't validate email format, so this test passes
      // If email validation is needed, add email validation rules to the schema
      expect(res.status).toBe(201);
      expect(res.body.email).toBe("invalid-email");
    });
  });

  describe("GET /support-form - Get all tickets", () => {
    it("should return all tickets", async () => {
      // Create test data
      const ticket1 = await SupportForm.create({
        name: "User 1",
        email: "user1@example.com",
        message: "Issue 1",
        ticketID: "T00001"
      });

      const ticket2 = await SupportForm.create({
        name: "User 2",
        email: "user2@example.com",
        message: "Issue 2",
        ticketID: "T00002"
      });

      const res = await request(app).get("/support-form");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].ticketID).toBe("T00001");
      expect(res.body[1].ticketID).toBe("T00002");
    });

    it("should return empty array when no tickets exist", async () => {
      const res = await request(app).get("/support-form");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("PUT /support-form/:ticketID - Update ticket status", () => {
    beforeEach(async () => {
      // Create base ticket for each test
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    it("should successfully update status to 'In Progress'", async () => {
      const res = await request(app)
        .put("/support-form/T00001")
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("In Progress");
      expect(res.body.completionTime).toBeNull();
    });

    it("should successfully update status to 'Completed' and set completion time", async () => {
      const res = await request(app)
        .put("/support-form/T00001")
        .send({ status: "Completed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Completed");
      expect(res.body.completionTime).toBeDefined();
      expect(new Date(res.body.completionTime)).toBeInstanceOf(Date);
    });

    it("should reject invalid status values", async () => {
      const res = await request(app)
        .put("/support-form/T00001")
        .send({ status: "InvalidStatus" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid status");
    });

    it("should reject non-existent ticket ID", async () => {
      const res = await request(app)
        .put("/support-form/T99999")
        .send({ status: "In Progress" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Ticket not found");
    });

    it("should accept all allowed status values", async () => {
      const allowedStatuses = ["New", "In Progress", "Completed"];
      
      for (const status of allowedStatuses) {
        const res = await request(app)
          .put("/support-form/T00001")
          .send({ status });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });
  });

  describe("DELETE /support-form/:ticketID - Delete ticket", () => {
    beforeEach(async () => {
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    it("should successfully delete existing ticket", async () => {
      const res = await request(app).delete("/support-form/T00001");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.deleted).toBe("T00001");

      // Verify ticket was deleted
      const deletedTicket = await SupportForm.findOne({ ticketID: "T00001" });
      expect(deletedTicket).toBeNull();
    });

    it("should reject deleting non-existent ticket", async () => {
      const res = await request(app).delete("/support-form/T99999");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Ticket not found");
    });
  });

  describe("POST /support-form/:ticketID/replies - Add reply", () => {
    beforeEach(async () => {
      await SupportForm.create({
        name: "Test User",
        email: "test@example.com",
        message: "Test message",
        ticketID: "T00001"
      });
    });

    it("should successfully add a reply", async () => {
      const replyMessage = "This is an admin reply";
      
      const res = await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: replyMessage });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.ticketID).toBe("T00001");
      expect(res.body.replies).toContain(replyMessage);
    });

    it("should support adding multiple replies", async () => {
      const reply1 = "First reply";
      const reply2 = "Second reply";

      await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: reply1 });

      const res = await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: reply2 });

      expect(res.status).toBe(200);
      expect(res.body.replies).toHaveLength(2);
      expect(res.body.replies).toContain(reply1);
      expect(res.body.replies).toContain(reply2);
    });

    it("should reject empty replies", async () => {
      const res = await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Reply message is required");
    });

    it("should reject whitespace-only replies", async () => {
      const res = await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Reply message is required");
    });

    it("should reject non-existent ticket ID", async () => {
      const res = await request(app)
        .post("/support-form/T99999/replies")
        .send({ message: "Reply message" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Ticket not found");
    });

    it("should automatically trim reply message whitespace", async () => {
      const replyMessage = "  This is a reply message  ";
      
      const res = await request(app)
        .post("/support-form/T00001/replies")
        .send({ message: replyMessage });

      expect(res.status).toBe(200);
      expect(res.body.replies).toContain("This is a reply message");
    });
  });

  describe("Ticket status and priority", () => {
    it("should set correct default status and priority", async () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("New");
      expect(res.body.priority).toBe("Normal");
    });

    it("should support custom priority", async () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Urgent issue",
        priority: "High"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.priority).toBe("High");
    });
  });

  describe("Timestamps and auto fields", () => {
    it("should automatically set created and updated timestamps", async () => {
      const payload = {
        name: "Test User",
        email: "test@example.com",
        message: "Test message"
      };

      const res = await request(app)
        .post("/support-form")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
      expect(new Date(res.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(res.body.updatedAt)).toBeInstanceOf(Date);
    });
  });
});