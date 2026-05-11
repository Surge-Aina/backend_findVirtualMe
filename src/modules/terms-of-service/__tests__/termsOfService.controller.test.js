jest.mock("../termsOfService.service", () => ({
  termsOfServiceService: {
    getByOwner: jest.fn(),
    getById: jest.fn(),
    getPublicByPortfolio: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const { termsOfServiceService } = require("../termsOfService.service");
const controller = require("../termsOfService.controller");

describe("termsOfService.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("getMyTermsOfService", async () => {
    mockReq = { user: { id: "u1" } };
    termsOfServiceService.getByOwner.mockResolvedValue([]);

    await controller.getMyTermsOfService(mockReq, mockRes);

    expect(termsOfServiceService.getByOwner).toHaveBeenCalledWith("u1");
    expect(mockRes.json).toHaveBeenCalledWith([]);
  });

  it("getTermsOfService 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    termsOfServiceService.getById.mockResolvedValue(null);

    await controller.getTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("getPublicTermsByPortfolio 400", async () => {
    mockReq = { query: {} };

    await controller.getPublicTermsByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("createTermsOfService 201", async () => {
    mockReq = { body: { name: "n" }, user: { id: "u1" } };
    const created = { _id: "1" };
    termsOfServiceService.create.mockResolvedValue(created);

    await controller.createTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(created);
  });

  it("updateTermsOfService 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" }, body: {} };
    termsOfServiceService.update.mockResolvedValue(null);

    await controller.updateTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("deleteTermsOfService success", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    termsOfServiceService.remove.mockResolvedValue({ _id: "x" });

    await controller.deleteTermsOfService(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ message: "Terms of service deleted" });
  });

  it("getMyTermsOfService 500", async () => {
    mockReq = { user: { id: "u1" } };
    termsOfServiceService.getByOwner.mockRejectedValue(new Error("db"));

    await controller.getMyTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("getTermsOfService success", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" } };
    termsOfServiceService.getById.mockResolvedValue({ _id: "1" });

    await controller.getTermsOfService(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ _id: "1" });
  });

  it("getTermsOfService 500", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" } };
    termsOfServiceService.getById.mockRejectedValue(new Error("db"));

    await controller.getTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("getPublicTermsByPortfolio success", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    termsOfServiceService.getPublicByPortfolio.mockResolvedValue({ ok: 1 });

    await controller.getPublicTermsByPortfolio(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ ok: 1 });
  });

  it("getPublicTermsByPortfolio 404", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    termsOfServiceService.getPublicByPortfolio.mockResolvedValue(null);

    await controller.getPublicTermsByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("getPublicTermsByPortfolio 500", async () => {
    mockReq = { query: { portfolioId: "p", type: "t" } };
    termsOfServiceService.getPublicByPortfolio.mockRejectedValue(new Error("db"));

    await controller.getPublicTermsByPortfolio(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("createTermsOfService 400", async () => {
    mockReq = { body: {}, user: { id: "u1" } };
    termsOfServiceService.create.mockRejectedValue(new Error("bad"));

    await controller.createTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("updateTermsOfService success", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" }, body: {} };
    termsOfServiceService.update.mockResolvedValue({ _id: "1" });

    await controller.updateTermsOfService(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ _id: "1" });
  });

  it("updateTermsOfService 400", async () => {
    mockReq = { params: { id: "1" }, user: { id: "u1" }, body: {} };
    termsOfServiceService.update.mockRejectedValue(new Error("bad"));

    await controller.updateTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("deleteTermsOfService 404", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    termsOfServiceService.remove.mockResolvedValue(null);

    await controller.deleteTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("deleteTermsOfService 500", async () => {
    mockReq = { params: { id: "x" }, user: { id: "u1" } };
    termsOfServiceService.remove.mockRejectedValue(new Error("db"));

    await controller.deleteTermsOfService(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
