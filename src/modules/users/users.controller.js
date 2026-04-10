const User = require("../../shared/models/User");
const { normalizeUserAppTheme } = require("../../shared/utils/userSerialize");
const Subscriptions = require("../../shared/models/Subscriptions");
const bcrypt = require("bcrypt");
const Stripe = require("stripe");
const Portfolio = require("../../legacy/project-manager/models/portfolioModel");
const subscriptionAccess = require("../payments/subscription-access.service");

const stripeSecretkey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;
const stripe = new Stripe(stripeSecretkey);

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

      const sessionId = data.sessionId;
      if (sessionId) {
        await Portfolio.updateMany(
          { sessionId },
          { $set: { email: onboardingUser.email, sessionId: null } },
        );
      }
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
    const { stripeCustomerId } = req.user;

    if (!stripeCustomerId) {
      return res.status(200).json({ subscriptionList: [] });
    }

    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 1,
      customer: stripeCustomerId,
      expand: ["data.plan.product"],
    });

    console.log(`fetched subscription info for ${req.user.email} from stripe`);
    res.status(200).json({ subscriptionList: subscriptions.data });
  } catch (error) {
    res.status(500).json({
      message: "error getting subscription info",
      error: error.message,
    });
  }
};

exports.getHasSubscription = async (req, res) => {
  try {
    const { email } = req.user;

    const sub = await Subscriptions.findOne({ email });
    if (!sub) {
      return res
        .status(404)
        .json({ message: "No subscription found", hasSubscription: false });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No User found", hasSubscription: false });
    }

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

exports.getAiEditAccess = async (req, res) => {
  try {
    const user = req.user || {};
    console.log(
      `[AI-ACCESS] checking for email=${user.email}, stripeCustomerId=${user.stripeCustomerId}`,
    );
    const access = await subscriptionAccess.getAiEditingAccess(user);
    console.log(
      `[AI-ACCESS] result: hasAccess=${access.hasAccess}, subscription=${JSON.stringify(access.subscription?._id || null)}, usage=${JSON.stringify(access.usage)}`,
    );
    const planName = access.subscription?.subscriptionType || null;

    res.status(200).json({
      hasAccess: access.hasAccess,
      planName,
      usage: access.usage,
    });
  } catch (error) {
    console.error("Error in getAiEditAccess:", error);
    res.status(500).json({
      message: "Error checking AI edit access",
      error: error.message,
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.user._id;
    const user = await User.findByIdAndUpdate(id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    console.error("Update user error in users.controller.js:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateAppTheme = async (req, res) => {
  try {
    const { appTheme } = req.body;
    if (appTheme !== "light" && appTheme !== "dark") {
      return res
        .status(400)
        .json({ message: "appTheme must be 'light' or 'dark'" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { appTheme } },
      { new: true, runValidators: true },
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user: normalizeUserAppTheme(user) });
  } catch (error) {
    console.error("updateAppTheme error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;

    const { currentPassword, newPassword } = req.body;
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const isSame = await bcrypt.compare(newPassword, user.password);

    if (isSame) {
      return res
        .status(400)
        .json({ message: "New password must be different" });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error in users.controller.js:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const portfolioIds = user.portfolios || [];
    res.status(200).json({
      user: normalizeUserAppTheme(user),
      portfolioIds,
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addPortfolioID = async (req, res) => {
  try {
    const userID = req.user._id;

    const user = await User.findByIdAndUpdate(
      userID,
      { $push: { portfolios: req.body } },
      { new: true, runValidators: true },
      { $addToSet: { portfolios: req.body } },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("addPortfolioID error in users.controller.js:", error);
    res.status(500).json({ message: error.message });
  }
};
