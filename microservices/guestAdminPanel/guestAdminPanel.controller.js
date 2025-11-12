const guestUserService = require("../guestLogin/guestUser.service");

exports.getAllUsers = async (req, res) => {
  try {
       const { portfolioId } = req.query;
    const result = await guestUserService.getAllUsers(portfolioId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to fetch users",
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error in guestUser.controller for getAllUsers():", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.editUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedInfo = req.body;

    const user = await guestUserService.updateUser({ userId, updatedInfo });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error in guestAdminPanel.controller for editUser():", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
