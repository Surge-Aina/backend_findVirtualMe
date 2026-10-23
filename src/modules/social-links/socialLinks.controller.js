const { socialLinksService } = require("./socialLinks.service");
const { assertPortfolioOwner } = require("../portfolios/portfolio.service");

exports.getSocialLinks = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const data = await socialLinksService.getByPortfolioId(portfolioId);

    if (!data) return res.status(404).json({ message: "Social links not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSocialLinks = async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { links } = req.body;

    if (req.user?.role !== "admin") {
      const check = await assertPortfolioOwner(
        portfolioId,
        req.user?._id || req.user?.id
      );
      if (!check.ok) {
        return res.status(check.status).json({ message: check.error });
      }
    }

    const updated = await socialLinksService.updateLinks(portfolioId, links);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
