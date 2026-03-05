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

    let user = await User.findOne({
      $or: [
        { googleId: payload.sub },
        { email: payload.email }
      ]
    });

    let isNewUser = false;

    // If user doesn't exist, create a new one
    if (!user) {
      isNewUser = true;
      user = await User.create({
        email: payload.email,
        username: payload.email.split("@")[0],
        name: payload.name,
        firstName: payload.given_name,
        lastName: payload.family_name,
        googleId: payload.sub,
        authProvider: "google",
        avatar: payload.picture,
        role: "user",
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const portfolioIds = user.portfolios || [];

    res.status(200).json({ 
      message: "logged in successfully", 
      token, 
      user, 
      portfolioIds,
      isNewUser: isNewUser,
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
