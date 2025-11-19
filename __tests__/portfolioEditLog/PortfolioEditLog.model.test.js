const PortfolioEditLog = require("../../models/portfolioLogs/PortfolioEditLog");

// Note: Database connection is handled by setup.js
// We only need to clean up data after each test
afterEach(async () => {
  await PortfolioEditLog.deleteMany({});
});

describe("PortfolioEditLog Model", () => {
  describe("Schema Validation", () => {
    it("should create a valid portfolio edit log with required fields", async () => {
      const validLog = new PortfolioEditLog({
        userId: "user123",
        portfolioType: "handyman",
      });

      const savedLog = await validLog.save();

      expect(savedLog._id).toBeDefined();
      expect(savedLog.userId).toBe("user123");
      expect(savedLog.portfolioType).toBe("handyman");
      expect(savedLog.action).toBe("created"); // default value
      expect(savedLog.timestamp).toBeDefined();
    });

    it("should create a log with all optional fields", async () => {
      const mouseInfo = [
        {
          x: 100,
          y: 200,
          event: "click",
          element: "button",
          timestamp: new Date(),
        },
        {
          x: 150,
          y: 250,
          event: "hover",
          element: "input",
          timestamp: new Date(),
        },
      ];

      const fullLog = new PortfolioEditLog({
        userId: "user456",
        name: "John Doe",
        email: "john@example.com",
        portfolioID: "portfolio123",
        portfolioType: "dataScientist",
        action: "updated",
        sessionId: "session_12345",
        mouseInfo: mouseInfo,
        timestamp: new Date(),
      });

      const savedLog = await fullLog.save();

      expect(savedLog.name).toBe("John Doe");
      expect(savedLog.email).toBe("john@example.com");
      expect(savedLog.portfolioID).toBe("portfolio123");
      expect(savedLog.action).toBe("updated");
      expect(savedLog.sessionId).toBe("session_12345");
      expect(savedLog.mouseInfo).toHaveLength(2);
      expect(savedLog.mouseInfo[0].x).toBe(100);
      expect(savedLog.mouseInfo[0].event).toBe("click");
    });

    it("should fail to save log without userId", async () => {
      const invalidLog = new PortfolioEditLog({
        portfolioType: "handyman",
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });

    it("should fail to save log without portfolioType", async () => {
      const invalidLog = new PortfolioEditLog({
        userId: "user123",
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });

    it("should use default action 'created' when not provided", async () => {
      const log = new PortfolioEditLog({
        userId: "user789",
        portfolioType: "photographer",
      });

      const savedLog = await log.save();
      expect(savedLog.action).toBe("created");
    });

    it("should reject invalid action enum value", async () => {
      const invalidLog = new PortfolioEditLog({
        userId: "user123",
        portfolioType: "handyman",
        action: "invalid_action",
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });

    it("should reject invalid mouse event enum value", async () => {
      const invalidLog = new PortfolioEditLog({
        userId: "user123",
        portfolioType: "handyman",
        mouseInfo: [
          {
            x: 100,
            y: 200,
            event: "invalid_event",
            element: "button",
          },
        ],
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });
  });

  describe("Mouse Info Schema", () => {
    it("should save mouse info with all fields", async () => {
      const mouseInfo = {
        x: 300,
        y: 400,
        event: "move",
        element: "div",
        timestamp: new Date("2024-01-01"),
      };

      const log = new PortfolioEditLog({
        userId: "user999",
        portfolioType: "softwareEngineer",
        mouseInfo: [mouseInfo],
      });

      const savedLog = await log.save();
      expect(savedLog.mouseInfo[0].x).toBe(300);
      expect(savedLog.mouseInfo[0].y).toBe(400);
      expect(savedLog.mouseInfo[0].event).toBe("move");
      expect(savedLog.mouseInfo[0].element).toBe("div");
    });

    it("should handle empty mouseInfo array", async () => {
      const log = new PortfolioEditLog({
        userId: "user111",
        portfolioType: "handyman",
        mouseInfo: [],
      });

      const savedLog = await log.save();
      expect(savedLog.mouseInfo).toEqual([]);
    });

    it("should handle multiple mouse events", async () => {
      const mouseEvents = [
        { x: 10, y: 20, event: "click", element: "button1" },
        { x: 30, y: 40, event: "hover", element: "button2" },
        { x: 50, y: 60, event: "move", element: "button3" },
      ];

      const log = new PortfolioEditLog({
        userId: "user222",
        portfolioType: "handyman",
        mouseInfo: mouseEvents,
      });

      const savedLog = await log.save();
      expect(savedLog.mouseInfo).toHaveLength(3);
    });
  });

  describe("Model Methods", () => {
    it("should find logs by userId", async () => {
      await PortfolioEditLog.create({
        userId: "user_find",
        portfolioType: "handyman",
      });

      const foundLogs = await PortfolioEditLog.find({ userId: "user_find" });
      expect(foundLogs).toHaveLength(1);
      expect(foundLogs[0].userId).toBe("user_find");
    });

    it("should find logs by portfolioID", async () => {
      await PortfolioEditLog.create({
        userId: "user1",
        portfolioID: "portfolio_find",
        portfolioType: "handyman",
      });

      const foundLogs = await PortfolioEditLog.find({
        portfolioID: "portfolio_find",
      });
      expect(foundLogs).toHaveLength(1);
      expect(foundLogs[0].portfolioID).toBe("portfolio_find");
    });

    it("should find logs by sessionId", async () => {
      await PortfolioEditLog.create({
        userId: "user1",
        sessionId: "session_find",
        portfolioType: "handyman",
      });

      const foundLogs = await PortfolioEditLog.find({
        sessionId: "session_find",
      });
      expect(foundLogs).toHaveLength(1);
      expect(foundLogs[0].sessionId).toBe("session_find");
    });

    it("should update log entry", async () => {
      const log = await PortfolioEditLog.create({
        userId: "user_update",
        portfolioType: "handyman",
        action: "created",
      });

      const updatedLog = await PortfolioEditLog.findByIdAndUpdate(
        log._id,
        { action: "updated" },
        { new: true }
      );

      expect(updatedLog.action).toBe("updated");
    });

    it("should delete log entry", async () => {
      const log = await PortfolioEditLog.create({
        userId: "user_delete",
        portfolioType: "handyman",
      });

      await PortfolioEditLog.findByIdAndDelete(log._id);

      const foundLog = await PortfolioEditLog.findById(log._id);
      expect(foundLog).toBeNull();
    });
  });

  describe("Data Types", () => {
    it("should handle string fields correctly", async () => {
      const log = new PortfolioEditLog({
        userId: "string_user",
        name: "Test Name",
        email: "test@example.com",
        portfolioID: "portfolio_string",
        portfolioType: "handyman",
        sessionId: "session_string",
      });

      const savedLog = await log.save();
      expect(typeof savedLog.userId).toBe("string");
      expect(typeof savedLog.name).toBe("string");
      expect(typeof savedLog.email).toBe("string");
    });

    it("should handle Date fields correctly", async () => {
      const customDate = new Date("2024-01-15T10:30:00Z");
      const log = new PortfolioEditLog({
        userId: "date_user",
        portfolioType: "handyman",
        timestamp: customDate,
      });

      const savedLog = await log.save();
      expect(savedLog.timestamp).toBeInstanceOf(Date);
      expect(savedLog.timestamp.getTime()).toBe(customDate.getTime());
    });

    it("should handle number fields in mouseInfo", async () => {
      const log = new PortfolioEditLog({
        userId: "number_user",
        portfolioType: "handyman",
        mouseInfo: [{ x: 123, y: 456, event: "click", element: "btn" }],
      });

      const savedLog = await log.save();
      expect(typeof savedLog.mouseInfo[0].x).toBe("number");
      expect(typeof savedLog.mouseInfo[0].y).toBe("number");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long userId", async () => {
      const longUserId = "a".repeat(500);
      const log = new PortfolioEditLog({
        userId: longUserId,
        portfolioType: "handyman",
      });

      const savedLog = await log.save();
      expect(savedLog.userId).toBe(longUserId);
    });

    it("should handle special characters in fields", async () => {
      const log = new PortfolioEditLog({
        userId: "user@#$%",
        name: "Test & User < >",
        email: "test+user@example.com",
        portfolioType: "handyman",
      });

      const savedLog = await log.save();
      expect(savedLog.name).toBe("Test & User < >");
      expect(savedLog.email).toBe("test+user@example.com");
    });

    it("should handle unicode characters", async () => {
      const log = new PortfolioEditLog({
        userId: "user_unicode",
        name: "测试用户 🌍 émojis 🚀",
        portfolioType: "handyman",
      });

      const savedLog = await log.save();
      expect(savedLog.name).toBe("测试用户 🌍 émojis 🚀");
    });

    it("should handle multiple logs with same userId", async () => {
      await PortfolioEditLog.create({
        userId: "same_user",
        portfolioType: "handyman",
        action: "created",
      });

      await PortfolioEditLog.create({
        userId: "same_user",
        portfolioType: "handyman",
        action: "updated",
      });

      const logs = await PortfolioEditLog.find({ userId: "same_user" });
      expect(logs).toHaveLength(2);
    });
  });
});

