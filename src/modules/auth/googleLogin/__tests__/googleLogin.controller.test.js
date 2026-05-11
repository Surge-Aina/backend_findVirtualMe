jest.mock("../googleLogin.service", () => ({
  verifyGoogleToken: jest.fn(),
}));

jest.mock("../../../../shared/models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("jwt-token"),
}));

const { verifyGoogleToken } = require("../googleLogin.service");
const User = require("../../../../shared/models/User");
const controller = require("../googleLogin.controller");

describe("googleLogin.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "secret";
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("returns 400 without idToken", async () => {
    mockReq = { body: {} };

    await controller.googleLogin(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when email not verified", async () => {
    mockReq = { body: { idToken: "t" } };
    verifyGoogleToken.mockResolvedValue({ email_verified: false });

    await controller.googleLogin(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("creates user and returns token when new", async () => {
    mockReq = { body: { idToken: "t" } };
    verifyGoogleToken.mockResolvedValue({
      email_verified: true,
      sub: "g1",
      email: "new@b.com",
      name: "N",
      given_name: "G",
      family_name: "F",
      picture: "pic",
    });
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: "uid",
      role: "user",
      portfolios: [],
      toObject: () => ({ email: "new@b.com", role: "user" }),
    });

    await controller.googleLogin(mockReq, mockRes);

    expect(User.create).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    const body = mockRes.json.mock.calls[0][0];
    expect(body.token).toBe("jwt-token");
    expect(body.isNewUser).toBe(true);
  });

  it("logs in existing user", async () => {
    mockReq = { body: { idToken: "t" } };
    verifyGoogleToken.mockResolvedValue({
      email_verified: true,
      sub: "g1",
      email: "e@b.com",
    });
    const existing = {
      _id: "uid",
      role: "user",
      portfolios: [1],
      appTheme: "dark",
    };
    User.findOne.mockResolvedValue(existing);

    await controller.googleLogin(mockReq, mockRes);

    expect(User.create).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalled();
    const body = mockRes.json.mock.calls[0][0];
    expect(body.isNewUser).toBe(false);
  });

  it("returns 401 on verify failure", async () => {
    mockReq = { body: { idToken: "t" } };
    verifyGoogleToken.mockRejectedValue(new Error("bad"));

    await controller.googleLogin(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
