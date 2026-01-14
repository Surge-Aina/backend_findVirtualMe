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
      user = await User.create({
        email: payload.email,
        name: payload.name,
        googleId: payload.sub,
        authProvider: "google",
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
