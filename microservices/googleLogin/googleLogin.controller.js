const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { verifyGoogleToken } = require("./googleLogin.service");

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "Missing idToken" });

    const payload = await verifyGoogleToken(idToken);

    if (!payload.email_verified) {
      return res.status(401).json({ message: "Email not verified" });
    }

    let user = await User.findOne({ email: payload.email });

    if (!user) {
      return res.status(400).json({ message: "Create a user first" });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    const portfolioIds = user.portfolios || [];
    res
      .status(201)
      .json({ message: "logged in successfully", token, user, portfolioIds });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
