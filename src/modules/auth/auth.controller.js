const User = require("../../shared/models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { buildLoginSuccessPayload } = require("./auth.service");

exports.signupUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "validation_error",
        message: "name, username, email, and password are required",
      });
    }

    const emailQuery = typeof email === "string" ? email.trim() : "";
    const usernameQuery = typeof username === "string" ? username.trim() : "";

    const userExists = await User.findOne({ email: emailQuery });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const usernameTaken = await User.findOne({ username: usernameQuery });
    if (usernameTaken) {
      return res.status(409).json({
        error: "conflict",
        message: "Username already in use",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username: usernameQuery,
      email: emailQuery,
      password: hashed,
      authProvider: "local",
    });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ name, username, email, token });
  } catch (err) {
    if (err?.code === 11000) {
      const field = err.keyPattern?.username ? "username" : "email";
      return res.status(409).json({
        error: "conflict",
        message: field === "username" ? "Username already in use" : "User already exists",
      });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and Password needed" });

    const emailQuery = typeof email === "string" ? email.trim() : "";
    const user = await User.findOne({ email: emailQuery });
    if (!user)
      return res
        .status(400)
        .json({ message: "User not found for this portfolio" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    res.status(201).json(buildLoginSuccessPayload(user));
  } catch (err) {
    console.log("error loggin in: ", err);
    res.status(500).json({ message: "error loggin in", error: err.message });
  }
};
