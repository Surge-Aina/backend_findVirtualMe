const { socialLinksService } = require("./socialLinks.service");

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

    const updated = await socialLinksService.updateLinks(portfolioId, links);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
