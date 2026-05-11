jest.mock("../privacyPolicy.model", () => {
  const Mock = jest.fn();
  Mock.findOne = jest.fn();
  Mock.find = jest.fn();
  Mock.findOneAndUpdate = jest.fn();
  Mock.findOneAndDelete = jest.fn();
  Mock.updateMany = jest.fn().mockResolvedValue({});
  return Mock;
});

const PrivacyPolicy = require("../privacyPolicy.model");
const { privacyPolicyService } = require("../privacyPolicy.service");

describe("privacyPolicy.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getById", async () => {
    PrivacyPolicy.findOne.mockResolvedValue({ _id: "1" });

    await privacyPolicyService.getById("1", "o");

    expect(PrivacyPolicy.findOne).toHaveBeenCalledWith({ _id: "1", ownerId: "o" });
  });

  it("getByOwner", async () => {
    PrivacyPolicy.find.mockResolvedValue([]);

    await privacyPolicyService.getByOwner("o");

    expect(PrivacyPolicy.find).toHaveBeenCalledWith({ ownerId: "o" });
  });

  it("getPublicByPortfolio", async () => {
    PrivacyPolicy.findOne.mockResolvedValue(null);

    await privacyPolicyService.getPublicByPortfolio({ id: "p", type: "t" });

    expect(PrivacyPolicy.findOne).toHaveBeenCalledWith({
      "portfolios.id": "p",
      "portfolios.type": "t",
    });
  });

  it("create saves and detaches", async () => {
    const portfolios = [{ id: "507f1f77bcf86cd799439011", type: "healthcare" }];
    const saved = { _id: "newid", portfolios, ownerId: "o" };
    PrivacyPolicy.mockImplementation(function () {
      this.save = jest.fn().mockResolvedValue(saved);
      return this;
    });

    const result = await privacyPolicyService.create(
      { name: "n", portfolios },
      "o"
    );

    expect(PrivacyPolicy.updateMany).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it("update calls detach when doc exists", async () => {
    const updated = {
      _id: "1",
      portfolios: [{ id: "507f1f77bcf86cd799439011", type: "healthcare" }],
      ownerId: "o",
    };
    PrivacyPolicy.findOneAndUpdate.mockResolvedValue(updated);

    const result = await privacyPolicyService.update("1", "o", { name: "x" });

    expect(PrivacyPolicy.updateMany).toHaveBeenCalled();
    expect(result).toBe(updated);
  });

  it("update returns null when not found", async () => {
    PrivacyPolicy.findOneAndUpdate.mockResolvedValue(null);

    const result = await privacyPolicyService.update("1", "o", {});

    expect(result).toBeNull();
    expect(PrivacyPolicy.updateMany).not.toHaveBeenCalled();
  });

  it("remove", async () => {
    PrivacyPolicy.findOneAndDelete.mockResolvedValue({ _id: "1" });

    await privacyPolicyService.remove("1", "o");

    expect(PrivacyPolicy.findOneAndDelete).toHaveBeenCalledWith({
      _id: "1",
      ownerId: "o",
    });
  });
});
