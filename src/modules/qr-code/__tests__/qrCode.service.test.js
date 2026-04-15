jest.mock("../qrCode.model", () =>
  jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: "new" }),
  }))
);

const QrCode = require("../qrCode.model");
QrCode.findOne = jest.fn();
QrCode.find = jest.fn();
QrCode.findOneAndUpdate = jest.fn();
QrCode.findOneAndDelete = jest.fn();

const service = require("../qrCode.service");

describe("qrCode.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getOnePublicQrCode delegates to findOne", () => {
    const chain = {};
    QrCode.findOne.mockReturnValue(chain);

    const r = service.getOnePublicQrCode("id");

    expect(QrCode.findOne).toHaveBeenCalledWith({ _id: "id", active: true });
    expect(r).toBe(chain);
  });

  it("getPublicQrCodes with ownerId adds filter", () => {
    const chain = {};
    QrCode.find.mockReturnValue(chain);

    const r = service.getPublicQrCodes("o1");

    expect(QrCode.find).toHaveBeenCalledWith({ active: true, ownerId: "o1" });
    expect(r).toBe(chain);
  });

  it("getPublicQrCodes without ownerId", () => {
    QrCode.find.mockReturnValue({});

    service.getPublicQrCodes();

    expect(QrCode.find).toHaveBeenCalledWith({ active: true });
  });

  it("getPublicQrCodesByPortfolio builds filter", () => {
    QrCode.find.mockReturnValue({});

    service.getPublicQrCodesByPortfolio({ id: "p", type: "t" });

    expect(QrCode.find).toHaveBeenCalledWith({
      active: true,
      "portfolio.id": "p",
      "portfolio.type": "t",
    });
  });

  it("getOneQrCode", () => {
    QrCode.findOne.mockReturnValue({});

    service.getOneQrCode("id", "owner");

    expect(QrCode.findOne).toHaveBeenCalledWith({ _id: "id", ownerId: "owner" });
  });

  it("getQrCodesbyPortfolio applies optional filters", () => {
    QrCode.find.mockReturnValue({});

    service.getQrCodesbyPortfolio("o", "p", "t");

    expect(QrCode.find).toHaveBeenCalledWith({
      ownerId: "o",
      "portfolio.id": "p",
      "portfolio.type": "t",
    });
  });

  it("createQrCode saves new doc", async () => {
    const save = jest.fn().mockResolvedValue({ _id: "n" });
    QrCode.mockImplementationOnce(() => ({ save }));

    const result = await service.createQrCode({ title: "x" }, "o1");

    expect(QrCode).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(result).toEqual({ _id: "n" });
  });

  it("updateQrCode", () => {
    QrCode.findOneAndUpdate.mockReturnValue({});

    service.updateQrCode("id", "o", { title: "n" });

    expect(QrCode.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "id", ownerId: "o" },
      { title: "n" },
      { new: true }
    );
  });

  it("deleteQrCode", () => {
    QrCode.findOneAndDelete.mockReturnValue({});

    service.deleteQrCode("id", "o");

    expect(QrCode.findOneAndDelete).toHaveBeenCalledWith({
      _id: "id",
      ownerId: "o",
    });
  });

  it("toggleActiveQrCode toggles and saves", async () => {
    const qr = { active: true, save: jest.fn().mockResolvedValue({ active: false }) };
    QrCode.findOne.mockResolvedValue(qr);

    const result = await service.toggleActiveQrCode("id", "o");

    expect(qr.active).toBe(false);
    expect(qr.save).toHaveBeenCalled();
    expect(result).toEqual({ active: false });
  });

  it("toggleActiveQrCode throws when not found", async () => {
    QrCode.findOne.mockResolvedValue(null);

    await expect(service.toggleActiveQrCode("id", "o")).rejects.toThrow(
      "QR code not found"
    );
  });

  it("toggleActiveQrCode wraps save errors", async () => {
    const qr = {
      active: true,
      save: jest.fn().mockRejectedValue(new Error("save failed")),
    };
    QrCode.findOne.mockResolvedValue(qr);

    await expect(service.toggleActiveQrCode("id", "o")).rejects.toThrow(
      "save failed"
    );
  });
});
