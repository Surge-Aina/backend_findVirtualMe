jest.mock("../voucher.model", () => ({
  Voucher: { findOne: jest.fn() },
}));

jest.mock("../userVoucher.model", () => ({
  UserVoucher: {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

const { Voucher } = require("../voucher.model");
const { UserVoucher } = require("../userVoucher.model");
const voucherService = require("../voucher.service");

describe("voucher.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("grantVoucher returns null when no voucher def", async () => {
    Voucher.findOne.mockResolvedValue(null);

    const r = await voucherService.grantVoucher({
      userId: "u",
      trigger: "x",
    });

    expect(r).toBeNull();
  });

  it("grantVoucher creates UserVoucher", async () => {
    Voucher.findOne.mockResolvedValue({ _id: "vid", autoGrantOn: "signup" });
    UserVoucher.create.mockResolvedValue({ _id: "uv" });

    const r = await voucherService.grantVoucher({
      userId: "u",
      trigger: "signup",
    });

    expect(r).toEqual({ _id: "uv" });
  });

  it("grantVoucher rethrows non-duplicate errors", async () => {
    Voucher.findOne.mockResolvedValue({ _id: "v" });
    UserVoucher.create.mockRejectedValue(new Error("other"));

    await expect(
      voucherService.grantVoucher({ userId: "u", trigger: "t" })
    ).rejects.toThrow("other");
  });

  it("grantVoucher returns null on duplicate key", async () => {
    Voucher.findOne.mockResolvedValue({ _id: "v" });
    const dup = new Error("dup");
    dup.code = 11000;
    UserVoucher.create.mockRejectedValue(dup);

    const r = await voucherService.grantVoucher({
      userId: "u",
      trigger: "t",
    });

    expect(r).toBeNull();
  });

  it("getActiveVouchers populates", async () => {
    const chain = { populate: jest.fn().mockResolvedValue([]) };
    UserVoucher.find.mockReturnValue(chain);

    await voucherService.getActiveVouchers("u");

    expect(UserVoucher.find).toHaveBeenCalledWith({
      userId: "u",
      status: "active",
    });
    expect(chain.populate).toHaveBeenCalledWith("voucherId");
  });

  it("applyDomainVoucher returns price when no free_domain vouchers", async () => {
    UserVoucher.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        { voucherId: { type: "other" } },
      ]),
    });

    const r = await voucherService.applyDomainVoucher("u", 50);

    expect(r.finalPrice).toBe(50);
    expect(r.voucher).toBeNull();
  });

  it("applyDomainVoucher returns price when no vouchers", async () => {
    UserVoucher.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });

    const r = await voucherService.applyDomainVoucher("u", 100);

    expect(r).toEqual({ finalPrice: 100, discount: 0, voucher: null });
  });

  it("applyDomainVoucher uses percentage when no amount", async () => {
    const vouchers = [
      {
        voucherId: { type: "free_domain", discountPercentage: 25 },
      },
    ];
    UserVoucher.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(vouchers),
    });

    const r = await voucherService.applyDomainVoucher("u", 200);

    expect(r.discount).toBe(50);
    expect(r.finalPrice).toBe(150);
  });

  it("applyDomainVoucher picks best free_domain voucher", async () => {
    const vouchers = [
      {
        voucherId: { type: "free_domain", discountAmount: 5 },
      },
      {
        voucherId: { type: "free_domain", discountPercentage: 50 },
      },
    ];
    UserVoucher.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(vouchers),
    });

    const r = await voucherService.applyDomainVoucher("u", 100);

    expect(r.discount).toBe(50);
    expect(r.finalPrice).toBe(50);
  });

  it("redeemVoucher updates status", async () => {
    UserVoucher.findByIdAndUpdate.mockResolvedValue({ _id: "uv" });

    await voucherService.redeemVoucher("uv");

    expect(UserVoucher.findByIdAndUpdate).toHaveBeenCalledWith(
      "uv",
      expect.objectContaining({ status: "redeemed" }),
      { new: true }
    );
  });
});
