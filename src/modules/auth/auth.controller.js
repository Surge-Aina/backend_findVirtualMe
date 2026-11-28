const User = require("../../shared/models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { buildLoginSuccessPayload } = require("./auth.service");
const {
  activateInvitedMembershipsForUser,
} = require("../account-teams/membershipActivation.service");
const { isAccountTeamsEnabled } = require("../../shared/config/accountTeams");

exports.signupUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res
        .status(500)
        .json({ error: "name, username, email or password missing" });
    }

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      email,
      password: hashed,
      authProvider: "local",
    });
    await newUser.save();

    if (isAccountTeamsEnabled()) {
      await activateInvitedMembershipsForUser(newUser);
    }

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ name, username, email, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and Password needed" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ message: "User not found for this portfolio" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    if (isAccountTeamsEnabled()) {
      await activateInvitedMembershipsForUser(user);
    }

    res.status(201).json(buildLoginSuccessPayload(user));
  } catch (err) {
    console.log("error loggin in: ", err);
    res.status(500).json({ message: "error loggin in", error: err.message });
  }
};
