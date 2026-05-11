jest.mock("../../models/Portfolio", () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock("../../portfolio.service", () => ({
  getPortfolioForViewer: jest.fn(),
}));

const Portfolio = require("../../models/Portfolio");
const portfolioService = require("../../portfolio.service");
const {
  getPublicPortfolios,
  getMyPortfolio,
  togglePublicPortfolio,
  deletePortfolio,
} = require("../publicPortfolios.service");

describe("publicPortfolios.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPublicPortfolios", () => {
    it("returns public portfolios", async () => {
      const lean = jest.fn().mockResolvedValue([{ _id: "1" }]);
      Portfolio.find.mockReturnValue({ lean });

      const result = await getPublicPortfolios();

      expect(Portfolio.find).toHaveBeenCalledWith({ visibility: "public" });
      expect(result).toEqual([{ _id: "1" }]);
    });

    it("rethrows on error", async () => {
      Portfolio.find.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(getPublicPortfolios()).rejects.toThrow("db");
    });
  });

  describe("getMyPortfolio", () => {
    it("delegates to portfolioService", async () => {
      portfolioService.getPortfolioForViewer.mockResolvedValue({ ok: true });

      const result = await getMyPortfolio("type", "id", "viewer");

      expect(portfolioService.getPortfolioForViewer).toHaveBeenCalledWith(
        "id",
        "viewer"
      );
      expect(result).toEqual({ ok: true });
    });

    it("rethrows on error", async () => {
      portfolioService.getPortfolioForViewer.mockImplementation(() => {
        throw new Error("fail");
      });

      await expect(getMyPortfolio("t", "i", "v")).rejects.toThrow("fail");
    });
  });

  describe("togglePublicPortfolio", () => {
    it("returns null when not found", async () => {
      Portfolio.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await togglePublicPortfolio("pid");

      expect(result).toBeNull();
    });

    it("toggles public to private", async () => {
      const doc = {
        _id: "pid",
        visibility: "public",
        template: "tmpl",
        save: jest.fn().mockResolvedValue(),
      };
      Portfolio.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(doc),
      });

      const result = await togglePublicPortfolio("pid");

      expect(doc.visibility).toBe("private");
      expect(doc.save).toHaveBeenCalled();
      expect(result).toEqual({
        _id: "pid",
        isPublic: false,
        portfolioType: "tmpl",
      });
    });

    it("toggles private to public", async () => {
      const doc = {
        _id: "pid",
        visibility: "private",
        template: "x",
        save: jest.fn().mockResolvedValue(),
      };
      Portfolio.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(doc),
      });

      const result = await togglePublicPortfolio("pid");

      expect(doc.visibility).toBe("public");
      expect(result.isPublic).toBe(true);
    });

    it("rethrows on error", async () => {
      Portfolio.findById.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(togglePublicPortfolio("pid")).rejects.toThrow("db");
    });
  });

  describe("deletePortfolio", () => {
    it("returns null when not found", async () => {
      Portfolio.findByIdAndDelete.mockResolvedValue(null);

      const result = await deletePortfolio("pid");

      expect(result).toBeNull();
    });

    it("returns id when deleted", async () => {
      Portfolio.findByIdAndDelete.mockResolvedValue({ _id: "pid" });

      const result = await deletePortfolio("pid");

      expect(result).toEqual({ _id: "pid" });
    });

    it("rethrows on error", async () => {
      Portfolio.findByIdAndDelete.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(deletePortfolio("pid")).rejects.toThrow("db");
    });
  });
});
