jest.mock("../voucher.service", () => ({
  getActiveVouchers: jest.fn(),
  grantVoucher: jest.fn(),
  applyDomainVoucher: jest.fn(),
  redeemVoucher: jest.fn(),
}));

const voucherService = require("../voucher.service");
const controller = require("../voucher.controller");

describe("voucher.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("getMyVouchers", async () => {
    mockReq = { user: { _id: "u1" } };
    voucherService.getActiveVouchers.mockResolvedValue([]);

    await controller.getMyVouchers(mockReq, mockRes);

    expect(voucherService.getActiveVouchers).toHaveBeenCalledWith("u1");
    expect(mockRes.json).toHaveBeenCalledWith([]);
  });

  it("getMyVouchers 500", async () => {
    mockReq = { user: { _id: "u1" } };
    voucherService.getActiveVouchers.mockRejectedValue(new Error("x"));

    await controller.getMyVouchers(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("grantVoucher", async () => {
    mockReq = { body: { userId: "u", trigger: "t" } };
    voucherService.grantVoucher.mockResolvedValue({ ok: true });

    await controller.grantVoucher(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
  });

  it("applyDomainVoucher", async () => {
    mockReq = { user: { _id: "u1" }, body: { price: 10 } };
    voucherService.applyDomainVoucher.mockResolvedValue({ finalPrice: 9 });

    await controller.applyDomainVoucher(mockReq, mockRes);

    expect(voucherService.applyDomainVoucher).toHaveBeenCalledWith("u1", 10);
  });

  it("redeemVoucher", async () => {
    mockReq = { body: { userVoucherId: "uv1" } };
    voucherService.redeemVoucher.mockResolvedValue({ status: "redeemed" });

    await controller.redeemVoucher(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ status: "redeemed" });
  });

  it("grantVoucher 500", async () => {
    mockReq = { body: {} };
    voucherService.grantVoucher.mockRejectedValue(new Error("x"));

    await controller.grantVoucher(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("applyDomainVoucher 500", async () => {
    mockReq = { user: { _id: "u1" }, body: { price: 10 } };
    voucherService.applyDomainVoucher.mockRejectedValue(new Error("x"));

    await controller.applyDomainVoucher(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("redeemVoucher 500", async () => {
    mockReq = { body: { userVoucherId: "uv1" } };
    voucherService.redeemVoucher.mockRejectedValue(new Error("x"));

    await controller.redeemVoucher(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
