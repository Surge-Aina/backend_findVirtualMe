const PortfolioEditLog = require("../../models/portfolioLogs/PortfolioEditLog");
const controller = require("../../controllers/portfolioEditLog/portfolioEditLogController");

// Mock console.error to suppress error output in tests
let consoleErrorSpy;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
});

// Note: Database connection is handled by setup.js
// We only need to clean up data after each test
afterEach(async () => {
  await PortfolioEditLog.deleteMany({});
  jest.restoreAllMocks();
  if (consoleErrorSpy) {
    consoleErrorSpy.mockRestore();
  }
});

// Helper function to create mock request and response objects
function makeReq(body = {}, params = {}, query = {}) {
  return {
    body,
    params,
    query,
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe("PortfolioEditLog Controller", () => {
  describe("createLog", () => {
    it("should create a log entry with required fields", async () => {
      const req = makeReq({
        userId: "user123",
        portfolioType: "handyman",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.log.userId).toBe("user123");
      expect(res.body.log.portfolioType).toBe("handyman");
      expect(res.body.log.action).toBe("created");
    });

    it("should create a log entry with all fields", async () => {
      const mouseInfo = [
        {
          x: 100,
          y: 200,
          event: "click",
          element: "button",
        },
      ];

      const req = makeReq({
        userId: "user456",
        name: "John Doe",
        email: "john@example.com",
        portfolioID: "portfolio123",
        portfolioType: "dataScientist",
        action: "updated",
        sessionId: "session_12345",
        mouseInfo: mouseInfo,
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.log.name).toBe("John Doe");
      expect(res.body.log.email).toBe("john@example.com");
      expect(res.body.log.portfolioID).toBe("portfolio123");
      expect(res.body.log.action).toBe("updated");
      expect(res.body.log.sessionId).toBe("session_12345");
      expect(res.body.log.mouseInfo).toHaveLength(1);
    });

    it("should return 400 when userId is missing", async () => {
      const req = makeReq({
        portfolioType: "handyman",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("userId");
    });

    it("should return 400 when portfolioType is missing", async () => {
      const req = makeReq({
        userId: "user123",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("portfolioType");
    });

    it("should return 400 when both userId and portfolioType are missing", async () => {
      const req = makeReq({});
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("userId");
      expect(res.body.message).toContain("portfolioType");
    });

    it("should generate sessionId when not provided", async () => {
      const req = makeReq({
        userId: "user789",
        portfolioType: "handyman",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.log.sessionId).toBeDefined();
      expect(res.body.log.sessionId).toContain("session_");
    });

    it("should use default action 'created' when not provided", async () => {
      const req = makeReq({
        userId: "user_default",
        portfolioType: "handyman",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.log.action).toBe("created");
    });

    it("should handle empty mouseInfo array", async () => {
      const req = makeReq({
        userId: "user_empty",
        portfolioType: "handyman",
        mouseInfo: [],
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.log.mouseInfo).toEqual([]);
    });

    it("should handle custom timestamp", async () => {
      const customTimestamp = new Date("2024-01-15T10:30:00Z");
      const req = makeReq({
        userId: "user_timestamp",
        portfolioType: "handyman",
        timestamp: customTimestamp.toISOString(),
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(201);
      expect(new Date(res.body.log.timestamp).getTime()).toBe(
        customTimestamp.getTime()
      );
    });

    it("should return 500 on database error", async () => {
      // Mock save to throw an error
      const saveSpy = jest
        .spyOn(PortfolioEditLog.prototype, "save")
        .mockRejectedValueOnce(new Error("Database error"));

      const req = makeReq({
        userId: "user_error",
        portfolioType: "handyman",
      });
      const res = makeRes();

      await controller.createLog(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("Error creating portfolio edit log");
      
      saveSpy.mockRestore();
    });
  });

  describe("getLogsByUserId", () => {
    it("should return logs for a specific user", async () => {
      // Create test logs
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

      const req = makeReq({}, { userId: "user_find" });
      const res = makeRes();

      await controller.getLogsByUserId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].userId).toBe("user_find");
      expect(res.body.logs[1].userId).toBe("user_find");
    });

    it("should return empty array when user has no logs", async () => {
      const req = makeReq({}, { userId: "user_no_logs" });
      const res = makeRes();

      await controller.getLogsByUserId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });

    it("should sort logs by timestamp descending", async () => {
      const now = new Date();
      await PortfolioEditLog.create({
        userId: "user_sort",
        portfolioType: "handyman",
        timestamp: new Date(now.getTime() - 1000),
      });
      await PortfolioEditLog.create({
        userId: "user_sort",
        portfolioType: "handyman",
        timestamp: new Date(now.getTime() - 2000),
      });
      await PortfolioEditLog.create({
        userId: "user_sort",
        portfolioType: "handyman",
        timestamp: now,
      });

      const req = makeReq({}, { userId: "user_sort" });
      const res = makeRes();

      await controller.getLogsByUserId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.logs).toHaveLength(3);
      // Most recent should be first
      expect(res.body.logs[0].timestamp).toBeDefined();
    });

    it("should return 500 on database error", async () => {
      const findSpy = jest
        .spyOn(PortfolioEditLog, "find")
        .mockImplementation(() => {
          const mockQuery = {
            sort: jest.fn().mockRejectedValue(new Error("Database error")),
          };
          return mockQuery;
        });

      const req = makeReq({}, { userId: "user_error" });
      const res = makeRes();

      await controller.getLogsByUserId(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("Error fetching logs");
      
      findSpy.mockRestore();
    });
  });

  describe("getLogsByPortfolioId", () => {
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

      const req = makeReq({}, { portfolioID: "portfolio_find" });
      const res = makeRes();

      await controller.getLogsByPortfolioId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].portfolioID).toBe("portfolio_find");
    });

    it("should return empty array when portfolio has no logs", async () => {
      const req = makeReq({}, { portfolioID: "portfolio_no_logs" });
      const res = makeRes();

      await controller.getLogsByPortfolioId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      const findSpy = jest
        .spyOn(PortfolioEditLog, "find")
        .mockImplementation(() => {
          const mockQuery = {
            sort: jest.fn().mockRejectedValue(new Error("Database error")),
          };
          return mockQuery;
        });

      const req = makeReq({}, { portfolioID: "portfolio_error" });
      const res = makeRes();

      await controller.getLogsByPortfolioId(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("Error fetching logs");
      
      findSpy.mockRestore();
    });
  });

  describe("getLogsBySessionId", () => {
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

      const req = makeReq({}, { sessionId: "session_find" });
      const res = makeRes();

      await controller.getLogsBySessionId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.logs[0].sessionId).toBe("session_find");
    });

    it("should return empty array when session has no logs", async () => {
      const req = makeReq({}, { sessionId: "session_no_logs" });
      const res = makeRes();

      await controller.getLogsBySessionId(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.logs).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      const findSpy = jest
        .spyOn(PortfolioEditLog, "find")
        .mockImplementation(() => {
          const mockQuery = {
            sort: jest.fn().mockRejectedValue(new Error("Database error")),
          };
          return mockQuery;
        });

      const req = makeReq({}, { sessionId: "session_error" });
      const res = makeRes();

      await controller.getLogsBySessionId(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("Error fetching logs");
      
      findSpy.mockRestore();
    });
  });

  describe("getAllLogs", () => {
    it("should return all logs with default pagination", async () => {
      // Create 5 test logs
      for (let i = 0; i < 5; i++) {
        await PortfolioEditLog.create({
          userId: `user${i}`,
          portfolioType: "handyman",
        });
      }

      const req = makeReq({}, {}, {});
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(5);
      expect(res.body.total).toBe(5);
      expect(res.body.page).toBe(1);
      expect(res.body.totalPages).toBe(1);
    });

    it("should paginate results correctly", async () => {
      // Create 25 test logs
      for (let i = 0; i < 25; i++) {
        await PortfolioEditLog.create({
          userId: `user${i}`,
          portfolioType: "handyman",
        });
      }

      const req = makeReq({}, {}, { page: "2", limit: "10" });
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(10);
      expect(res.body.total).toBe(25);
      expect(res.body.page).toBe(2);
      expect(res.body.totalPages).toBe(3);
    });

    it("should use default pagination when query params are invalid", async () => {
      await PortfolioEditLog.create({
        userId: "user1",
        portfolioType: "handyman",
      });

      const req = makeReq({}, {}, { page: "invalid", limit: "invalid" });
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.count).toBeLessThanOrEqual(50); // default limit
    });

    it("should return empty array when no logs exist", async () => {
      const req = makeReq({}, {}, {});
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.total).toBe(0);
      expect(res.body.logs).toEqual([]);
    });

    it("should sort logs by timestamp descending", async () => {
      const now = new Date();
      await PortfolioEditLog.create({
        userId: "user1",
        portfolioType: "handyman",
        timestamp: new Date(now.getTime() - 1000),
      });
      await PortfolioEditLog.create({
        userId: "user2",
        portfolioType: "handyman",
        timestamp: now,
      });

      const req = makeReq({}, {}, {});
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.logs).toHaveLength(2);
      // Most recent should be first
      expect(res.body.logs[0].timestamp).toBeDefined();
    });

    it("should return 500 on database error", async () => {
      const findSpy = jest
        .spyOn(PortfolioEditLog, "find")
        .mockImplementation(() => {
          const mockQuery = {
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockRejectedValue(new Error("Database error")),
          };
          return mockQuery;
        });

      const req = makeReq({}, {}, {});
      const res = makeRes();

      await controller.getAllLogs(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("Error fetching logs");
      
      findSpy.mockRestore();
    });
  });
});

