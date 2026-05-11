jest.mock("../userPortfoliosArray.service", () => ({
  updatePortfolioArray: jest.fn(),
  getPortfolioList: jest.fn(),
  updateAllUsersPortfolioArrays: jest.fn(),
}));

const {
  updateUserPortfolios,
  getPortfoliosByList,
  updateAllUsersPortfolios,
} = require("../userPortfoliosArray.controller");
const service = require("../userPortfoliosArray.service");

describe("userPortfoliosArray.controller", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("updateUserPortfolios", () => {
    it("returns 200 with portfolios on success", async () => {
      const userId = { toString: () => "uid1" };
      mockReq = { user: { _id: userId } };
      const updated = { portfolios: [{ portfolioId: "p1" }] };
      service.updatePortfolioArray.mockResolvedValue(updated);

      await updateUserPortfolios(mockReq, mockRes);

      expect(service.updatePortfolioArray).toHaveBeenCalledWith(userId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User portfolios updated",
        portfolios: updated.portfolios,
      });
    });

    it("returns 500 when updatePortfolioArray throws", async () => {
      mockReq = { user: { _id: "u1" } };
      service.updatePortfolioArray.mockRejectedValue(new Error("db"));

      await updateUserPortfolios(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Failed to update portfolios",
      });
    });
  });

  describe("getPortfoliosByList", () => {
    it("returns 400 when portfolio list is missing", async () => {
      mockReq = { body: {} };

      await getPortfoliosByList(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "portfolio list is required",
      });
      expect(service.getPortfolioList).not.toHaveBeenCalled();
    });

    it("returns 400 when portfolio list is not an array", async () => {
      mockReq = { body: { portfolios: "not-array" } };

      await getPortfoliosByList(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("returns 200 with portfolios on success", async () => {
      const list = [{ portfolioId: "p1", portfolioType: "x" }];
      mockReq = { body: { portfolios: list } };
      const found = [{ _id: "p1" }];
      service.getPortfolioList.mockResolvedValue(found);

      await getPortfoliosByList(mockReq, mockRes);

      expect(service.getPortfolioList).toHaveBeenCalledWith(list);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ portfolios: found });
    });

    it("returns 500 when getPortfolioList throws", async () => {
      mockReq = { body: { portfolios: [] } };
      service.getPortfolioList.mockRejectedValue(new Error("db"));

      await getPortfoliosByList(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Failed to fetch portfolios",
      });
    });
  });

  describe("updateAllUsersPortfolios", () => {
    it("returns 200 with count on success", async () => {
      mockReq = {};
      service.updateAllUsersPortfolioArrays.mockResolvedValue([{}, {}]);

      await updateAllUsersPortfolios(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "All users' portfolios updated",
        count: 2,
      });
    });

    it("returns 500 when updateAllUsersPortfolioArrays throws", async () => {
      mockReq = {};
      service.updateAllUsersPortfolioArrays.mockRejectedValue(new Error("db"));

      await updateAllUsersPortfolios(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Failed to update portfolios for all users",
      });
    });
  });
});
