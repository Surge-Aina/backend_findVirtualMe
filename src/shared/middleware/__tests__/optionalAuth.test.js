jest.mock("../../models/User", () => ({
  findById: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const optionalAuth = require("../optionalAuth");

describe("optionalAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("calls next when no token", async () => {
    const req = { headers: {} };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("sets dummy user for cypress header", async () => {
    const req = { headers: { authorization: "Bearer x", "x-cypress": "1" } };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(req.user._id).toBe("test-user-id");
    expect(next).toHaveBeenCalled();
  });

  it("sets dummy user for dummy-token", async () => {
    const req = { headers: { authorization: "Bearer dummy-token" } };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(req.user.email).toBe("vendor@example.com");
    expect(next).toHaveBeenCalled();
  });

  it("loads user from valid jwt", async () => {
    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439011", role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439011" }),
    });

    await optionalAuth(req, {}, next);

    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it("skips user when jwt expired by exp claim", async () => {
    const token = jwt.sign(
      {
        id: "507f1f77bcf86cd799439011",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(req.user).toBeUndefined();
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("calls next on verify error", async () => {
    const req = { headers: { authorization: "Bearer not-a-jwt" } };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalled();
  });
});
