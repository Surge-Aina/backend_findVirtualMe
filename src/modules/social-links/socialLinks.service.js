const SocialLinks = require("./socialLinks.model.js");

exports.socialLinksService = {
  async getByPortfolioId(portfolioId) {
    return await SocialLinks.findOne({ portfolioId });
  },

  async updateLinks(portfolioId, links) {
    const updated = await SocialLinks.findOneAndUpdate(
      { portfolioId },
      { links },
      { new: true, upsert: true } // create if doesn't exist
    );
    return updated;
  },
};
