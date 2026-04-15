jest.mock("../passwordReset.service", () => ({
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

const service = require("../passwordReset.service");
const controller = require("../passwordReset.controller");

describe("passwordReset.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("forgotPassword returns 200", async () => {
    mockReq = { body: { email: "a@b.com" } };
    service.forgotPassword.mockResolvedValue({ success: true });

    await controller.forgotPassword(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it("forgotPassword 500", async () => {
    mockReq = { body: { email: "a@b.com" } };
    service.forgotPassword.mockRejectedValue(new Error("x"));

    await controller.forgotPassword(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("resetPassword returns 400 when service says failure", async () => {
    mockReq = { params: { token: "t" }, body: { password: "Aa1!aaaa" } };
    service.resetPassword.mockResolvedValue({ success: false, message: "bad" });

    await controller.resetPassword(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("resetPassword returns 200 on success", async () => {
    mockReq = { params: { token: "t" }, body: { password: "Aa1!aaaa" } };
    service.resetPassword.mockResolvedValue({ success: true });

    await controller.resetPassword(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
