const User = require("../../models/User");
const Portfolio = require("../../models/portfolio/Portfolio");

exports.getUserPortfoliosArrayByUserId = async (userId) => {
  return Portfolio.find({ owner: userId }).lean();
};

async function updatePortfolioArray(userId) {
  try {
    const portfolios = await Portfolio.find({ owner: userId })
      .select("_id template visibility")
      .lean();

    const userPortfolios = portfolios.map((p) => ({
      portfolioId: p._id,
      portfolioType: p.template,
      isPublic: p.visibility === "public",
    }));

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { portfolios: userPortfolios },
      { new: true }
    );

    return updatedUser;
  } catch (error) {
    console.error("Error updating portfolio array:", error);
    throw error;
  }
}
exports.updatePortfolioArray = updatePortfolioArray;

exports.getPortfolioList = async (portfolioList) => {
  const ids = portfolioList.map((p) => p.portfolioId).filter(Boolean);
  return Portfolio.find({ _id: { $in: ids } }).lean();
};

exports.updateAllUsersPortfolioArrays = async function () {
  const users = await User.find({}, { _id: 1 });
  const updatedUsers = await Promise.all(
    users.map((user) => updatePortfolioArray(user._id))
  );
  return updatedUsers;
};
