const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../../models/User");
const { sendPasswordResetEmail } = require("../../services/emailService");

// FORGOT PASSWORD
exports.forgotPassword = async (email) => {
  try {
    if (!email) {
      return {
        success: false,
        message: "Email is required",
      };
    }

    const user = await User.findOne({ email });

    // Security: never reveal if user exists
    if (!user) {
      return {
        success: true,
        message: "If email exists, reset link sent",
      };
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Hash token before storing
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Save to user
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins

    await user.save();

    // Create reset URL
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    // Send email (non-blocking like your contact form pattern)
    sendPasswordResetEmail(user.email, user.name || user.username, resetURL)
      .then(() => console.log(" Reset email sent"))
      .catch((err) =>
        console.error(" Error sending reset email:", err.message),
      );

    return {
      success: true,
      message: "If email exists, reset link sent",
    };
  } catch (error) {
    console.error("Forgot password service error:", error);
    throw error;
  }
};

// RESET PASSWORD
exports.resetPassword = async (token, newPassword) => {
  try {
    if (!token || !newPassword) {
      return {
        success: false,
        message: "Token and new password are required",
      };
    }

    // Hash incoming token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return {
        success: false,
        message: "Invalid or expired token",
      };
    }

    // Optional: prevent same password reuse
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return {
        success: false,
        message: "New password must be different from old password",
      };
    }

    //  Validate password strength (same as your changePassword)
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return {
        success: false,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      };
    }

    // Hash new password (same pattern as your controller)
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return {
      success: true,
      message: "Password reset successful",
    };
  } catch (error) {
    console.error(" Reset password service error:", error);
    throw error;
  }
};
