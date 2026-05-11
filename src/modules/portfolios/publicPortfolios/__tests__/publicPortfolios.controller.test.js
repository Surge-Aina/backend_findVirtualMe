jest.mock("../publicPortfolios.service", () => ({
  getPublicPortfolios: jest.fn(),
  togglePublicPortfolio: jest.fn(),
  getMyPortfolio: jest.fn(),
  deletePortfolio: jest.fn(),
}));

jest.mock("../../../../shared/models/User", () => ({
  findByIdAndUpdate: jest.fn(),
}));

const {
  getPublicPortfolios,
  getPortfolio,
  togglePublicPortfolio,
  deletePortfolio,
} = require("../publicPortfolios.controller");
const service = require("../publicPortfolios.service");
const User = require("../../../../shared/models/User");

describe("publicPortfolios.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("getPublicPortfolios", () => {
    it("returns portfolios on success", async () => {
      mockReq = {};
      const list = [{ _id: "1" }];
      service.getPublicPortfolios.mockResolvedValue(list);

      await getPublicPortfolios(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        portfolios: list,
      });
    });

    it("returns 500 on error", async () => {
      mockReq = {};
      service.getPublicPortfolios.mockRejectedValue(new Error("db"));

      await getPublicPortfolios(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Error getting public portfolios",
      });
    });
  });

  describe("getPortfolio", () => {
    it("returns 404 when portfolio not found", async () => {
      mockReq = { params: { type: "t", id: "id1" }, user: { _id: "u1" } };
      service.getMyPortfolio.mockResolvedValue(null);

      await getPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Portfolio not found" });
    });

    it("returns result when found", async () => {
      mockReq = { params: { type: "t", id: "id1" }, user: { id: "u2" } };
      const result = { data: 1 };
      service.getMyPortfolio.mockResolvedValue(result);

      await getPortfolio(mockReq, mockRes);

      expect(service.getMyPortfolio).toHaveBeenCalledWith("t", "id1", "u2");
      expect(mockRes.json).toHaveBeenCalledWith(result);
    });

    it("uses req.user._id when id not set", async () => {
      mockReq = { params: { type: "t", id: "id1" }, user: { _id: "oid" } };
      service.getMyPortfolio.mockResolvedValue({});

      await getPortfolio(mockReq, mockRes);

      expect(service.getMyPortfolio).toHaveBeenCalledWith("t", "id1", "oid");
    });

    it("returns 500 on error", async () => {
      mockReq = { params: { type: "t", id: "id1" } };
      service.getMyPortfolio.mockRejectedValue(new Error("db"));

      await getPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Error getting my portfolio",
      });
    });
  });

  describe("togglePublicPortfolio", () => {
    it("returns 404 when toggle returns null", async () => {
      mockReq = { params: { id: "p1" } };
      service.togglePublicPortfolio.mockResolvedValue(null);

      await togglePublicPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Portfolio not found",
      });
    });

    it("returns portfolio on success", async () => {
      mockReq = { params: { id: "p1" } };
      const result = { _id: "p1", isPublic: true };
      service.togglePublicPortfolio.mockResolvedValue(result);

      await togglePublicPortfolio(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        portfolio: result,
      });
    });

    it("returns 500 on error", async () => {
      mockReq = { params: { id: "p1" } };
      service.togglePublicPortfolio.mockRejectedValue(new Error("db"));

      await togglePublicPortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Error toggling public portfolio",
      });
    });
  });

  describe("deletePortfolio", () => {
    it("returns 404 when delete returns null", async () => {
      mockReq = { params: { id: "p1" }, user: { _id: "u1" } };
      service.deletePortfolio.mockResolvedValue(null);

      await deletePortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("pulls from user and returns success", async () => {
      mockReq = { params: { id: "p1" }, user: { _id: "u1" } };
      const result = { _id: "p1" };
      service.deletePortfolio.mockResolvedValue(result);
      User.findByIdAndUpdate.mockResolvedValue({});

      await deletePortfolio(mockReq, mockRes);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "u1",
        { $pull: { portfolios: { portfolioId: "p1" } } },
        { new: true }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        portfolio: result,
      });
    });

    it("returns 500 on error", async () => {
      mockReq = { params: { id: "p1" }, user: { _id: "u1" } };
      service.deletePortfolio.mockRejectedValue(new Error("db"));

      await deletePortfolio(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Error deleting portfolio",
      });
    });
  });
});
