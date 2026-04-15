jest.mock("../../../../shared/models/User", () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../models/Portfolio", () => ({
  find: jest.fn(),
}));

const User = require("../../../../shared/models/User");
const Portfolio = require("../../models/Portfolio");
const {
  getUserPortfoliosArrayByUserId,
  updatePortfolioArray,
  getPortfolioList,
  updateAllUsersPortfolioArrays,
} = require("../userPortfoliosArray.service");

describe("userPortfoliosArray.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserPortfoliosArrayByUserId", () => {
    it("returns lean portfolios for owner", async () => {
      const lean = jest.fn().mockResolvedValue([{ _id: "p1" }]);
      Portfolio.find.mockReturnValue({ lean });

      const result = await getUserPortfoliosArrayByUserId("uid");

      expect(Portfolio.find).toHaveBeenCalledWith({ owner: "uid" });
      expect(result).toEqual([{ _id: "p1" }]);
    });
  });

  describe("updatePortfolioArray", () => {
    it("maps portfolios and updates user", async () => {
      const portfolios = [
        { _id: "a", template: "t1", visibility: "public" },
        { _id: "b", template: "t2", visibility: "private" },
      ];
      const lean = jest.fn().mockResolvedValue(portfolios);
      Portfolio.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean }) });

      const updated = { portfolios: [] };
      User.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await updatePortfolioArray("uid");

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "uid",
        {
          portfolios: [
            { portfolioId: "a", portfolioType: "t1", isPublic: true },
            { portfolioId: "b", portfolioType: "t2", isPublic: false },
          ],
        },
        { new: true }
      );
      expect(result).toBe(updated);
    });

    it("rethrows on error", async () => {
      Portfolio.find.mockImplementation(() => {
        throw new Error("fail");
      });

      await expect(updatePortfolioArray("uid")).rejects.toThrow("fail");
    });
  });

  describe("getPortfolioList", () => {
    it("finds portfolios by ids from list", async () => {
      const lean = jest.fn().mockResolvedValue([{ _id: "x" }]);
      Portfolio.find.mockReturnValue({ lean });
      const list = [{ portfolioId: "a" }, { portfolioId: null }];

      const result = await getPortfolioList(list);

      expect(Portfolio.find).toHaveBeenCalledWith({ _id: { $in: ["a"] } });
      expect(result).toEqual([{ _id: "x" }]);
    });
  });

  describe("updateAllUsersPortfolioArrays", () => {
    it("updates each user portfolio array", async () => {
      User.find.mockResolvedValue([{ _id: "u1" }, { _id: "u2" }]);
      const lean = jest.fn().mockResolvedValue([]);
      Portfolio.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean }) });
      User.findByIdAndUpdate.mockResolvedValue({ portfolios: [] });

      const result = await updateAllUsersPortfolioArrays();

      expect(result).toHaveLength(2);
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
