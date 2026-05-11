jest.mock("../termsOfService.model", () => {
  const Mock = jest.fn();
  Mock.findOne = jest.fn();
  Mock.find = jest.fn();
  Mock.findOneAndUpdate = jest.fn();
  Mock.findOneAndDelete = jest.fn();
  Mock.updateMany = jest.fn().mockResolvedValue({});
  return Mock;
});

const TermsOfService = require("../termsOfService.model");
const { termsOfServiceService } = require("../termsOfService.service");

describe("termsOfService.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getById", async () => {
    TermsOfService.findOne.mockResolvedValue({ _id: "1" });

    await termsOfServiceService.getById("1", "o");

    expect(TermsOfService.findOne).toHaveBeenCalledWith({ _id: "1", ownerId: "o" });
  });

  it("getByOwner", async () => {
    TermsOfService.find.mockResolvedValue([]);

    await termsOfServiceService.getByOwner("o");

    expect(TermsOfService.find).toHaveBeenCalledWith({ ownerId: "o" });
  });

  it("getPublicByPortfolio", async () => {
    TermsOfService.findOne.mockResolvedValue(null);

    await termsOfServiceService.getPublicByPortfolio({ id: "p", type: "t" });

    expect(TermsOfService.findOne).toHaveBeenCalledWith({
      "portfolios.id": "p",
      "portfolios.type": "t",
    });
  });

  it("create saves and detaches", async () => {
    const portfolios = [{ id: "507f1f77bcf86cd799439011", type: "healthcare" }];
    const saved = { _id: "newid", portfolios, ownerId: "o" };
    TermsOfService.mockImplementation(function () {
      this.save = jest.fn().mockResolvedValue(saved);
      return this;
    });

    const result = await termsOfServiceService.create(
      { name: "n", portfolios },
      "o"
    );

    expect(TermsOfService.updateMany).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it("update calls detach when doc exists", async () => {
    const updated = {
      _id: "1",
      portfolios: [{ id: "507f1f77bcf86cd799439011", type: "healthcare" }],
      ownerId: "o",
    };
    TermsOfService.findOneAndUpdate.mockResolvedValue(updated);

    const result = await termsOfServiceService.update("1", "o", { name: "x" });

    expect(TermsOfService.updateMany).toHaveBeenCalled();
    expect(result).toBe(updated);
  });

  it("update returns null when not found", async () => {
    TermsOfService.findOneAndUpdate.mockResolvedValue(null);

    const result = await termsOfServiceService.update("1", "o", {});

    expect(result).toBeNull();
    expect(TermsOfService.updateMany).not.toHaveBeenCalled();
  });

  it("remove", async () => {
    TermsOfService.findOneAndDelete.mockResolvedValue({ _id: "1" });

    await termsOfServiceService.remove("1", "o");

    expect(TermsOfService.findOneAndDelete).toHaveBeenCalledWith({
      _id: "1",
      ownerId: "o",
    });
  });
});
