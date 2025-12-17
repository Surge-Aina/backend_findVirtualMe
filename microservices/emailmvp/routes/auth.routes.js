
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
// const { User } = require("../models/User");
const { EmailMvpUser: User } = require("../models/User");
const { authRequired } = require("../middleware/auth.middleware");
const router = express.Router();

// Helper: generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Simple health route to check DB + API
router.get("/health", (_req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const states = ["disconnected", "connected", "connecting", "disconnecting"];

  res.json({
    status: "ok",
    dbState: states[dbState] || dbState,
  });
});



// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already in use." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "User created.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup." });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = generateToken(user);

    res.json({
      message: "Logged in.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// Get current user (protected)
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id name email isVerified createdAt");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ message: "Server error fetching user." });
  }
});


module.exports = router;