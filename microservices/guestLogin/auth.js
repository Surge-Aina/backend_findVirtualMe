const jwt = require("jsonwebtoken");
const GuestUser = require("./guestUser.model");

const auth = async (req, res, next) => {
  try {
    //Get token from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    //Verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await GuestUser.findOne({
      _id: decodedToken.id,
      portfolioType: decodedToken.portfolioType,
    });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    //Attach user to request
    req.user = user;

    // continue to route
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = auth;
