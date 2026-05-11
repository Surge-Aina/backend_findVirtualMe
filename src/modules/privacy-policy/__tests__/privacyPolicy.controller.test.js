jest.mock("../privacyPolicy.service", () => ({
  privacyPolicyService: {
    getByOwner: jest.fn(),
    getById: jest.fn(),
    getPublicByPortfolio: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const { privacyPolicyService } = require("../privacyPolicy.service");
const controller = require("../privacyPolicy.controller");

describe("privacyPolicy.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("getMyPrivacyPolicies", async () => {
    mockReq = { user: { id: "u1" } };
    privacyPolicyService.getByOwner.mockResolvedValue([]);

    await controller.getMyPrivacyPolicies(mockReq, mockRes);

    expect(privacyPolicyService.getByOwner).toHaveBeenCalledWith("u1");
    expect(mockRes.json).toHaveBeenCalledWith([]);
  });

  it("getPrivacyPolicy 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    privacyPolicyService.getById.mockResolvedValue(null);

    await controller.getPrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("getPublicPrivacyPolicyByPortfolio 400", async () => {
    mockReq = { query: {} };

    await controller.getPublicPrivacyPolicyByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("createPrivacyPolicy 201", async () => {
    mockReq = { body: { name: "n" }, user: { id: "u1" } };
    const created = { _id: "1" };
    privacyPolicyService.create.mockResolvedValue(created);

    await controller.createPrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(created);
  });

  it("updatePrivacyPolicy 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" }, body: {} };
    privacyPolicyService.update.mockResolvedValue(null);

    await controller.updatePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("deletePrivacyPolicy success", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    privacyPolicyService.remove.mockResolvedValue({ _id: "x" });

    await controller.deletePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ message: "Privacy policy deleted" });
  });

  it("getMyPrivacyPolicies 500 on error", async () => {
    mockReq = { user: { id: "u1" } };
    privacyPolicyService.getByOwner.mockRejectedValue(new Error("db"));

    await controller.getMyPrivacyPolicies(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("getPrivacyPolicy returns policy", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" } };
    const doc = { _id: "1" };
    privacyPolicyService.getById.mockResolvedValue(doc);

    await controller.getPrivacyPolicy(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(doc);
  });

  it("getPrivacyPolicy 500", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" } };
    privacyPolicyService.getById.mockRejectedValue(new Error("db"));

    await controller.getPrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("getPublicPrivacyPolicyByPortfolio success", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    privacyPolicyService.getPublicByPortfolio.mockResolvedValue({ _id: "1" });

    await controller.getPublicPrivacyPolicyByPortfolio(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ _id: "1" });
  });

  it("getPublicPrivacyPolicyByPortfolio 404", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    privacyPolicyService.getPublicByPortfolio.mockResolvedValue(null);

    await controller.getPublicPrivacyPolicyByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("getPublicPrivacyPolicyByPortfolio 500", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    privacyPolicyService.getPublicByPortfolio.mockRejectedValue(new Error("db"));

    await controller.getPublicPrivacyPolicyByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("createPrivacyPolicy 400", async () => {
    mockReq = { body: {}, user: { id: "u1" } };
    privacyPolicyService.create.mockRejectedValue(new Error("bad"));

    await controller.createPrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("updatePrivacyPolicy success", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" }, body: { name: "n" } };
    privacyPolicyService.update.mockResolvedValue({ _id: "1" });

    await controller.updatePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ _id: "1" });
  });

  it("updatePrivacyPolicy 400", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" }, body: {} };
    privacyPolicyService.update.mockRejectedValue(new Error("bad"));

    await controller.updatePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("deletePrivacyPolicy 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    privacyPolicyService.remove.mockResolvedValue(null);

    await controller.deletePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("deletePrivacyPolicy 500", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    privacyPolicyService.remove.mockRejectedValue(new Error("db"));

    await controller.deletePrivacyPolicy(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
