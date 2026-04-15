jest.mock("../../../../shared/models/User", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../../../shared/services/emailService", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(),
}));

const User = require("../../../../shared/models/User");
const { sendPasswordResetEmail } = require("../../../../shared/services/emailService");
const bcrypt = require("bcrypt");
const passwordResetService = require("../passwordReset.service");

describe("passwordReset.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "http://localhost:5173";
  });

  it("forgotPassword requires email", async () => {
    const r = await passwordResetService.forgotPassword("");
    expect(r.success).toBe(false);
  });

  it("forgotPassword returns generic message when user missing", async () => {
    User.findOne.mockResolvedValue(null);

    const r = await passwordResetService.forgotPassword("x@y.com");

    expect(r.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("forgotPassword sends email when user exists", async () => {
    const user = {
      email: "a@b.com",
      name: "n",
      save: jest.fn().mockResolvedValue(),
    };
    User.findOne.mockResolvedValue(user);

    const r = await passwordResetService.forgotPassword("a@b.com");

    expect(r.success).toBe(true);
    expect(user.save).toHaveBeenCalled();
    await Promise.resolve();
    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  it("resetPassword requires token and password", async () => {
    const r = await passwordResetService.resetPassword("", "x");
    expect(r.success).toBe(false);
  });

  it("resetPassword invalid token", async () => {
    User.findOne.mockResolvedValue(null);

    const r = await passwordResetService.resetPassword("tok", "Aa1!aaaaaa");

    expect(r.success).toBe(false);
  });

  it("resetPassword rejects same password", async () => {
    User.findOne.mockResolvedValue({
      password: "hashed",
      save: jest.fn(),
    });
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const r = await passwordResetService.resetPassword("tok", "Aa1!aaaaaa");

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/different/);
  });

  it("resetPassword rejects weak password", async () => {
    User.findOne.mockResolvedValue({
      password: "hashed",
      save: jest.fn(),
    });
    bcrypt.compare = jest.fn().mockResolvedValue(false);

    const r = await passwordResetService.resetPassword("tok", "weak");

    expect(r.success).toBe(false);
  });

  it("resetPassword succeeds", async () => {
    const user = {
      password: "oldhash",
      save: jest.fn().mockResolvedValue(),
      resetPasswordToken: "h",
      resetPasswordExpires: Date.now() + 99999,
    };
    User.findOne.mockResolvedValue(user);
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    bcrypt.genSalt = jest.fn().mockResolvedValue("salt");
    bcrypt.hash = jest.fn().mockResolvedValue("newhash");

    const r = await passwordResetService.resetPassword("rawtok", "Aa1!aaaaaa");

    expect(r.success).toBe(true);
    expect(user.save).toHaveBeenCalled();
  });
});
