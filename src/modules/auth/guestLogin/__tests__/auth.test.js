const jwt = require("jsonwebtoken");
const auth = require("../auth");
const GuestUser = require("../guestUser.model");

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../guestUser.model");

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up JWT_SECRET
    process.env.JWT_SECRET = "test-secret-key";

    // Mock request, response, and next
    req = {
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe("Success Cases", () => {
    it("should authenticate user with valid token", async () => {
      const mockUser = {
        _id: "user123",
        email: "test@test.com",
        portfolioType: "photographer",
      };

      const mockDecodedToken = {
        id: "user123",
        portfolioType: "photographer",
      };

      req.headers.authorization = "Bearer validtoken123";
      jwt.verify.mockReturnValue(mockDecodedToken);
      GuestUser.findOne.mockResolvedValue(mockUser);

      await auth(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith("validtoken123", "test-secret-key");
      expect(GuestUser.findOne).toHaveBeenCalledWith({
        _id: "user123",
        portfolioType: "photographer",
      });
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should attach user object to request", async () => {
      const mockUser = {
        _id: "user456",
        email: "user@test.com",
        name: "Test User",
        portfolioType: "photographer",
      };

      req.headers.authorization = "Bearer token";
      jwt.verify.mockReturnValue({ id: "user456", portfolioType: "photographer" });
      GuestUser.findOne.mockResolvedValue(mockUser);

      await auth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user._id).toBe("user456");
      expect(req.user.email).toBe("user@test.com");
    });
  });

  describe("Missing/Invalid Authorization Header", () => {
    it("should return 401 when no authorization header", async () => {
      req.headers = {}; // No authorization header

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header is empty", async () => {
      req.headers.authorization = "";

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization doesn't start with Bearer", async () => {
      req.headers.authorization = "Basic token123";

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

   it("should return 401 when authorization is just 'Bearer'", async () => {
  req.headers.authorization = "Bearer";

  await auth(req, res, next);

  
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ message: "No token provided" }); 
  expect(next).not.toHaveBeenCalled();
});

  });

  describe("Invalid Token", () => {
    it("should return 401 when token is invalid", async () => {
      req.headers.authorization = "Bearer invalidtoken";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token is expired", async () => {
      req.headers.authorization = "Bearer expiredtoken";
      jwt.verify.mockImplementation(() => {
        const error = new Error("jwt expired");
        error.name = "TokenExpiredError";
        throw error;
      });

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token signature is invalid", async () => {
      req.headers.authorization = "Bearer malformedtoken";
      jwt.verify.mockImplementation(() => {
        const error = new Error("invalid signature");
        error.name = "JsonWebTokenError";
        throw error;
      });

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("User Not Found", () => {
    it("should return 401 when user not found in database", async () => {
      req.headers.authorization = "Bearer validtoken";
      jwt.verify.mockReturnValue({
        id: "nonexistent",
        portfolioType: "photographer",
      });
      GuestUser.findOne.mockResolvedValue(null); // User not found

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user exists but wrong portfolio type", async () => {
      req.headers.authorization = "Bearer validtoken";
      jwt.verify.mockReturnValue({
        id: "user123",
        portfolioType: "wrongType",
      });
      GuestUser.findOne.mockResolvedValue(null);

      await auth(req, res, next);

      expect(GuestUser.findOne).toHaveBeenCalledWith({
        _id: "user123",
        portfolioType: "wrongType",
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });
  });

  describe("Database Errors", () => {
    it("should return 401 on database error", async () => {
      req.headers.authorization = "Bearer validtoken";
      jwt.verify.mockReturnValue({ id: "user123", portfolioType: "photographer" });
      GuestUser.findOne.mockRejectedValue(new Error("Database connection failed"));

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });
  });


});