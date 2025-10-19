const User = require("../models/User");
const Subscriptions = require("../models/Subscriptions");
const bcrypt = require("bcrypt");
const req = require("express/lib/request");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const Portfolio = require("../models/projectManager/portfolioModel");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

// Not using the signup feature for now
exports.signupUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(500).json({ error: "name, username, email or password missing" });
    }

    // Can add checks with validator later to ensure email valid / password strong
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create and save new user
    const newUser = new User({ name, username, email, password: hashed });
    await newUser.save();

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
      return res.status(400).json({ message: "User not found for this portfolio" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });
    console.log("🔍 User found:", user._id);
    console.log("🔍 Creating token with id:", user._id);

    const token = jwt.sign(
      //{ id: user._id, isAdmin: user.isAdmin },// removed this so users are not signed in as admin. ADD BACK ONLY IF NECESSARY -CarlosG
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    //res.status(201).json({ token, isAdmin: user.isAdmin, }); //this one removed as well -CarlosG
    res.status(201).json({ message: "logged in successfully", token, user });
  } catch (err) {
    console.log("error loggin in: ", err);
    res.status(500).json({ message: "error loggin in", error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    console.log("🔍 getMe called, req.user:", req.user);

    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", user.email);
    res.status(200).json({ user });
  } catch (error) {
    console.error("❌ Error in getMe:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.addUser = async (req, res) => {
  const { data } = req.body;
  try {
    if (!data) {
      return res.status(400).json({ message: "Data not sent" });
    }
    const email = data.userInfo.email;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    //const username = (data.userInfo.username && data.userInfo.username.trim()) || email.split('@')[0];
    const username = data.userInfo.username;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const hashedPassword = await bcrypt.hash(data.userInfo.password, 10);

    const userObj = {
      firstName: data.userInfo.firstName,
      lastName: data.userInfo.lastName,
      username: username,
      email: data.userInfo.email,
      phone: data.userInfo.phone,
      location: data.userInfo.location,
      bio: data.userInfo.bio,
      password: hashedPassword,
      goal: data.goal,
      industry: data.industry,
      experienceLevel: data.experience,
      skills: data.skills,
    };

    let onboardingUser;
    try {
      onboardingUser = new User(userObj);
      await onboardingUser.save();

      // attach portfolios by sessionId
      const sessionId = data.sessionId;
      if (sessionId) {
        await Portfolio.updateMany(
          { sessionId },
          { $set: { email: onboardingUser.email, sessionId: null } }
        );
      }
      // end sessionId linking
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: "Email or username already exists (onboarding)" });
      }
      throw error;
    }
    res.status(201).json({ user: onboardingUser });
  } catch (error) {
    console.error("AddUser error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSubInfo = async (req, res) => {
  try {
    const { stripeCustomerId } = req.user; // obtained from auth middleware
    //get subscription info from stripe
    const subscriptions = await stripe.subscriptions.list({
      limit: 1,
      customer: stripeCustomerId,
      expand: ["data.plan.product"],
    });

    console.log(`fetched subscription info for ${req.user.email} from stripe`);
    res.status(200).json({ subscriptionList: subscriptions.data });
  } catch (error) {
    res
      .status(500)
      .json({ message: "error getting subscription info", error: error.message });
  }
};

exports.getHasSubscription = async (req, res) => {
  try {
    const { email } = req.user; // comes from auth middleware

    // Find subscription
    const sub = await Subscriptions.findOne({ email });
    if (!sub) {
      return res
        .status(404)
        .json({ message: "No subscription found", hasSubscription: false });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No User found", hasSubscription: false });
    }

    // Update user's subscription details if needed
    user.stripeSubscriptionId = sub.subscriptionId;
    user.stripeCustomerId = sub.customerId;
    await user.save();

    console.log(`User ${email} does have a subscription`);

    res.status(200).json({
      hasSubscription: true,
      subscriptionId: sub.subscriptionId,
      customerId: sub.customerId,
    });
  } catch (error) {
    console.error("Error in getHasSubscription:", error);
    res.status(500).json({
      message: "Error checking hasSubscription",
      error: error.message,
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    console.log("🔍 getMe called, req.user:", req.user);

    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", user.email);
    res.status(200).json({ user });
  } catch (error) {
    console.error("❌ Error in getMe:", error);
    res.status(500).json({ message: "Server error" });
  }
};
