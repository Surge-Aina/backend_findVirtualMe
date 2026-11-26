jest.mock("../../portfolio.service", () => ({
  getPortfolioForViewer: jest.fn(),
  getPublicPortfolios: jest.fn(),
  toggleVisibility: jest.fn(),
  getPortfolio: jest.fn(),
  deletePortfolio: jest.fn(),
}));

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
      portfolioService.getPublicPortfolios.mockResolvedValue([{ _id: "1" }]);

      const result = await getPublicPortfolios();

      expect(portfolioService.getPublicPortfolios).toHaveBeenCalled();
      expect(result).toEqual([{ _id: "1" }]);
    });

    it("rethrows on error", async () => {
      portfolioService.getPublicPortfolios.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(getPublicPortfolios()).rejects.toThrow("db");
    });
  });

  describe("getMyPortfolio", () => {
    it("delegates to portfolioService", async () => {
      portfolioService.getPortfolioForViewer.mockResolvedValue({ ok: true });

      const result = await getMyPortfolio("type", "id", "viewer");

      expect(portfolioService.getPortfolioForViewer).toHaveBeenCalledWith("id", "viewer");
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
    const originalFlag = process.env.SITE_DRAFTS_ENABLED;

    afterAll(() => {
      if (originalFlag === undefined) {
        delete process.env.SITE_DRAFTS_ENABLED;
      } else {
        process.env.SITE_DRAFTS_ENABLED = originalFlag;
      }
    });

    it("returns null when not found", async () => {
      process.env.SITE_DRAFTS_ENABLED = "false";
      portfolioService.toggleVisibility.mockResolvedValue(null);

      const result = await togglePublicPortfolio("pid");

      expect(result).toBeNull();
    });

    it("toggles visibility via portfolioService", async () => {
      process.env.SITE_DRAFTS_ENABLED = "false";
      portfolioService.toggleVisibility.mockResolvedValue({
        _id: "pid",
        visibility: "private",
      });
      portfolioService.getPortfolio.mockResolvedValue({ template: "tmpl" });

      const result = await togglePublicPortfolio("pid");

      expect(result).toEqual({
        _id: "pid",
        isPublic: false,
        portfolioType: "tmpl",
      });
    });

    it("marks draftMode when drafts flag is enabled", async () => {
      process.env.SITE_DRAFTS_ENABLED = "true";
      portfolioService.toggleVisibility.mockResolvedValue({
        _id: "pid",
        visibility: "public",
        draft: true,
      });
      portfolioService.getPortfolio.mockResolvedValue({ template: "x" });

      const result = await togglePublicPortfolio("pid");

      expect(result.draftMode).toBe(true);
      expect(result.isPublic).toBe(true);
    });

    it("rethrows on error", async () => {
      process.env.SITE_DRAFTS_ENABLED = "false";
      portfolioService.toggleVisibility.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(togglePublicPortfolio("pid")).rejects.toThrow("db");
    });
  });

  describe("deletePortfolio", () => {
    it("returns null when not found", async () => {
      portfolioService.deletePortfolio.mockResolvedValue(null);

      const result = await deletePortfolio("pid");

      expect(result).toBeNull();
    });

    it("delegates deletion to portfolioService", async () => {
      portfolioService.deletePortfolio.mockResolvedValue({ _id: "pid" });

      const result = await deletePortfolio("pid");

      expect(portfolioService.deletePortfolio).toHaveBeenCalledWith("pid");
      expect(result).toEqual({ _id: "pid" });
    });

    it("rethrows on error", async () => {
      portfolioService.deletePortfolio.mockImplementation(() => {
        throw new Error("db");
      });

      await expect(deletePortfolio("pid")).rejects.toThrow("db");
    });
  });
});