const mongoose = require("mongoose");

function normalizeDomain(input) {
  if (!input || typeof input !== "string") return null;

  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

function getPortfolioMeta(user, portfolioId) {
  if (!user?.portfolios || !portfolioId) return null;

  const targetId = mongoose.Types.ObjectId.isValid(portfolioId)
    ? portfolioId.toString()
    : null;

  if (!targetId) return null;

  return user.portfolios.find(p =>
    p.portfolioId?.toString() === targetId
  ) || null;
}

module.exports = {
  normalizeDomain,
  getPortfolioMeta
};
