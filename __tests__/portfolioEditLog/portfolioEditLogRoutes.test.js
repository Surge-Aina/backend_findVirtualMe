const express = require("express");
const request = require("supertest");
const portfolioEditLogRoutes = require("../../routes/portfolioEditLogRoutes");
const PortfolioEditLog = require("../../models/portfolioLogs/PortfolioEditLog");

// Note: Database connection is handled by setup.js
// Setup Express app with routes
const app = express();
app.use(express.json());
app.use("/api/portfolio-edit-log", portfolioEditLogRoutes);
app.use((req, res) => res.status(404).json({ message: "not found" }));

// We only need to clean up data after each test
afterEach(async () => {
  await PortfolioEditLog.deleteMany({});
  jest.clearAllMocks();
});

describe("PortfolioEditLog Routes", () => {
  describe("POST /api/portfolio-edit-log", () => {
    it("should create a new log entry", async () => {
      const logData = {
        userId: "user123",
        portfolioType: "handyman",
      };

      const res = await request(app)
        .post("/api/portfolio-edit-log")
        .send(logData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.log.userId).toBe("user123");
      expect(res.body.log.portfolioType).toBe("handyman");
    });

    it("should create a log entry with all fields", async () => {
      const logData = {
        userId: "user456",
        name: "John Doe",
        email: "john@example.com",
        portfolioID: "portfolio123",
        portfolioType: "dataScientist",
        action: "updated",
        sessionId: "session_12345",
        mouseInfo: [
          {
            x: 100,
            y: 200,
            event: "click",
            element: "button",
          },
        ],
      };

      const res = await request(app)
        .post("/api/portfolio-edit-log")
        .send(logData);

      expect(res.status).toBe(201);
      expect(res.body.log.name).toBe("John Doe");
      expect(res.body.log.email).toBe("john@example.com");
      expect(res.body.log.portfolioID).toBe("portfolio123");
      expect(res.body.log.action).toBe("updated");
    });

    it("should return 400 when userId is missing", async () => {
      const logData = {
        portfolioType: "handyman",
      };

      const res = await request(app)
        .post("/api/portfolio-edit-log")
        .send(logData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("userId");
    });

    it("should return 400 when portfolioType is missing", async () => {
      const logData = {
        userId: "user123",
      };

      const res = await request(app)
        .post("/api/portfolio-edit-log")
        .send(logData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("portfolioType");
    });

    it("should handle invalid JSON", async () => {
      const res = await request(app)
        .post("/api/portfolio-edit-log")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/portfolio-edit-log", () => {
    it("should return all logs with pagination", async () => {
      // Create test logs
      for (let i = 0; i < 5; i++) {
        await PortfolioEditLog.create({
          userId: `user${i}`,
          portfolioType: "handyman",
        });
      }

      const res = await request(app).get("/api/portfolio-edit-log");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(5);
      expect(res.body.total).toBe(5);
      expect(res.body.page).toBe(1);
    });

    it("should paginate results correctly", async () => {
      // Create 15 test logs
      for (let i = 0; i < 15; i++) {
        await PortfolioEditLog.create({
          userId: `user${i}`,
          portfolioType: "handyman",
        });
      }

      const res = await request(app).get(
        "/api/portfolio-edit-log?page=2&limit=5"
      );

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(2);
      expect(res.body.totalPages).toBe(3);
    });

    it("should return empty array when no logs exist", async () => {
      const res = await request(app).get("/api/portfolio-edit-log");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });
  });

  describe("GET /api/portfolio-edit-log/user/:userId", () => {
    it("should return logs for a specific user", async () => {
      await PortfolioEditLog.create({
        userId: "user_find",
        portfolioType: "handyman",
        action: "created",
      });
      await PortfolioEditLog.create({
        userId: "user_find",
        portfolioType: "handyman",
        action: "updated",
      });
      await PortfolioEditLog.create({
        userId: "other_user",
        portfolioType: "handyman",
      });

      const res = await request(app).get(
        "/api/portfolio-edit-log/user/user_find"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].userId).toBe("user_find");
      expect(res.body.logs[1].userId).toBe("user_find");
    });

    it("should return empty array when user has no logs", async () => {
      const res = await request(app).get(
        "/api/portfolio-edit-log/user/user_no_logs"
      );

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });

    it("should handle special characters in userId", async () => {
      await PortfolioEditLog.create({
        userId: "user@special",
        portfolioType: "handyman",
      });

      const res = await request(app).get(
        "/api/portfolio-edit-log/user/user@special"
      );

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });
  });

  describe("GET /api/portfolio-edit-log/portfolio/:portfolioID", () => {
    it("should return logs for a specific portfolio", async () => {
      await PortfolioEditLog.create({
        userId: "user1",
        portfolioID: "portfolio_find",
        portfolioType: "handyman",
      });
      await PortfolioEditLog.create({
        userId: "user2",
        portfolioID: "portfolio_find",
        portfolioType: "handyman",
      });
      await PortfolioEditLog.create({
        userId: "user3",
        portfolioID: "other_portfolio",
        portfolioType: "handyman",
      });

      const res = await request(app).get(
        "/api/portfolio-edit-log/portfolio/portfolio_find"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].portfolioID).toBe("portfolio_find");
    });

    it("should return empty array when portfolio has no logs", async () => {
      const res = await request(app).get(
        "/api/portfolio-edit-log/portfolio/portfolio_no_logs"
      );

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });
  });

  describe("GET /api/portfolio-edit-log/session/:sessionId", () => {
    it("should return logs for a specific session", async () => {
      await PortfolioEditLog.create({
        userId: "user1",
        sessionId: "session_find",
        portfolioType: "handyman",
      });
      await PortfolioEditLog.create({
        userId: "user2",
        sessionId: "session_find",
        portfolioType: "handyman",
      });
      await PortfolioEditLog.create({
        userId: "user3",
        sessionId: "other_session",
        portfolioType: "handyman",
      });

      const res = await request(app).get(
        "/api/portfolio-edit-log/session/session_find"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].sessionId).toBe("session_find");
    });

    it("should return empty array when session has no logs", async () => {
      const res = await request(app).get(
        "/api/portfolio-edit-log/session/session_no_logs"
      );

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });
  });

  describe("Route Error Handling", () => {
    it("should return 404 for non-existent routes", async () => {
      const res = await request(app).get("/api/portfolio-edit-log/invalid");

      expect(res.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      const res = await request(app).patch("/api/portfolio-edit-log");

      expect(res.status).toBe(404);
    });
  });

  describe("Integration Tests", () => {
    it("should create and retrieve logs in sequence", async () => {
      // Create a log
      const createRes = await request(app)
        .post("/api/portfolio-edit-log")
        .send({
          userId: "integration_user",
          portfolioID: "integration_portfolio",
          portfolioType: "handyman",
          sessionId: "integration_session",
        });

      expect(createRes.status).toBe(201);
      const createdLogId = createRes.body.log._id;

      // Retrieve by userId
      const userRes = await request(app).get(
        "/api/portfolio-edit-log/user/integration_user"
      );
      expect(userRes.status).toBe(200);
      expect(userRes.body.count).toBe(1);

      // Retrieve by portfolioID
      const portfolioRes = await request(app).get(
        "/api/portfolio-edit-log/portfolio/integration_portfolio"
      );
      expect(portfolioRes.status).toBe(200);
      expect(portfolioRes.body.count).toBe(1);

      // Retrieve by sessionId
      const sessionRes = await request(app).get(
        "/api/portfolio-edit-log/session/integration_session"
      );
      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.count).toBe(1);

      // All should return the same log
      expect(userRes.body.logs[0]._id).toBe(createdLogId);
      expect(portfolioRes.body.logs[0]._id).toBe(createdLogId);
      expect(sessionRes.body.logs[0]._id).toBe(createdLogId);
    });

    it("should handle multiple logs with pagination", async () => {
      // Create 30 logs
      for (let i = 0; i < 30; i++) {
        await PortfolioEditLog.create({
          userId: `user${i}`,
          portfolioType: "handyman",
        });
      }

      // Get first page
      const page1 = await request(app).get(
        "/api/portfolio-edit-log?page=1&limit=10"
      );
      expect(page1.status).toBe(200);
      expect(page1.body.count).toBe(10);
      expect(page1.body.page).toBe(1);

      // Get second page
      const page2 = await request(app).get(
        "/api/portfolio-edit-log?page=2&limit=10"
      );
      expect(page2.status).toBe(200);
      expect(page2.body.count).toBe(10);
      expect(page2.body.page).toBe(2);

      // Get third page
      const page3 = await request(app).get(
        "/api/portfolio-edit-log?page=3&limit=10"
      );
      expect(page3.status).toBe(200);
      expect(page3.body.count).toBe(10);
      expect(page3.body.page).toBe(3);
    });
  });
});

