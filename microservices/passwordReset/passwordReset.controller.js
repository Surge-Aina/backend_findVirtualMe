const passwordResetService = require("./passwordReset.service");

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await passwordResetService.forgotPassword(email);

    return res.status(200).json(result);
  } catch (error) {
    console.error(" Forgot password controller error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await passwordResetService.resetPassword(token, password);

    // handle expected failures (invalid token, weak password, etc.)
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(" Reset password controller error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
