const {
  updatePortfolioArray,
  getPortfolioList,
  updateAllUsersPortfolioArrays,
} = require("./userPortfoliosArray.service");
const User = require("../../models/User");

exports.updateUserPortfolios = async (req, res) => {
  try {
    const userId = req.user._id; //  auth middleware
    const email = req.user.email;

    const updatedUser = await updatePortfolioArray(userId, email);

    res.status(200).json({
      message: "User portfolios updated",
      portfolios: updatedUser.portfolios,
    });
  } catch (err) {
    console.error("Error updating user portfolios:", err);
    res.status(500).json({ message: "Failed to update portfolios" });
  }
};

exports.getPortfoliosByList = async (req, res) => {
  try {
    const portfolioList = req.body.portfolios; // expect [{ portfolioId, portfolioType }, ...]
    if (!portfolioList || !Array.isArray(portfolioList)) {
      return res.status(400).json({ message: "portfolio list is required" });
    }

    const portfolios = await getPortfolioList(portfolioList);
    res.status(200).json({ portfolios });
  } catch (err) {
    console.error("Error fetching portfolios:", err);
    res.status(500).json({ message: "Failed to fetch portfolios" });
  }
};

exports.updateAllUsersPortfolios = async (req, res) => {
  try {
    const updatedUsers = await updateAllUsersPortfolioArrays();
    res.status(200).json({
      message: "All users' portfolios updated",
      count: updatedUsers.length,
    });
  } catch (err) {
    console.error("Error updating all users' portfolios:", err);
    res.status(500).json({ message: "Failed to update portfolios for all users" });
  }
};
