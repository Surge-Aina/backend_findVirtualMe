const mongoose = require("mongoose");
const User = require("../../shared/models/User");
const {
  normalizeUserAppTheme,
  serializeUser,
  serializePublicUser,
} = require("../../shared/utils/userSerialize");
const Subscriptions = require("../../shared/models/Subscriptions");
const bcrypt = require("bcrypt");
const Stripe = require("stripe");
const Portfolio = require("../../legacy/project-manager/models/portfolioModel");
const UnifiedPortfolio = require("../portfolios/models/Portfolio");
const { assertPortfolioOwner } = require("../portfolios/portfolio.service");
const { templateToPortfolioType } = require("../../shared/utils/templateToPortfolioType");
const subscriptionAccess = require("../payments/subscription-access.service");

const SELF_UPDATE_FIELDS = [
  "firstName",
  "lastName",
  "username",
  "email",
  "phone",
  "location",
  "bio",
  "goal",
  "industry",
  "experienceLevel",
  "skills",
  "displayName",
  "name",
  "appTheme",
];
const ADMIN_UPDATE_FIELDS = [
  ...SELF_UPDATE_FIELDS,
  "role",
  "isAdmin",
  "isActive",
  "password",
];

function actorId(user) {
  return String(user?._id || user?.id || "");
}

function isAdmin(user) {
  return user?.role === "admin";
}

async function sanitizeUserUpdate(body, actorIsAdmin) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const allowed = new Set(actorIsAdmin ? ADMIN_UPDATE_FIELDS : SELF_UPDATE_FIELDS);
  const data = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("$") || !allowed.has(key)) continue;
    data[key] = value;
  }
  if (!actorIsAdmin) return data;
  if (typeof data.password === "string" && data.password.length > 0) {
    if (!data.password.startsWith("$2")) {
      data.password = await bcrypt.hash(data.password, 10);
    }
  } else {
    delete data.password;
  }
  return data;
}

async function linkablePortfolio(raw, user) {
  const check = await assertPortfolioOwner(raw, user._id);
  if (check.ok || (check.status === 403 && isAdmin(user))) {
    const doc = await UnifiedPortfolio.findById(raw).select("template").lean();
    return {
      ok: true,
      portfolioType: templateToPortfolioType(doc?.template) || "project_manager",
    };
  }
  if (check.status !== 404) {
    return { ok: false, status: check.status || 400, message: check.error || "Portfolio not found" };
  }
  const legacy = await Portfolio.findById(raw).select("email");
  if (!legacy) return { ok: false, status: 404, message: "Portfolio not found" };
  const ownerEmail = String(legacy.email || "").trim().toLowerCase();
  const actorEmail = String(user.email || "").trim().toLowerCase();
  if (!isAdmin(user) && (!actorEmail || ownerEmail !== actorEmail)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true, portfolioType: "project_manager" };
}

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
      role: "customer",
    };

    let onboardingUser;
    try {
      onboardingUser = new User(userObj);
      await onboardingUser.save();

      const sessionId = data.sessionId || req.body.sessionId;
      if (sessionId && typeof sessionId === "string") {
        try {
          await Portfolio.updateMany(
            {
              sessionId,
              email: { $regex: /@onboarding\.invalid$/i },
              $or: [{ userId: null }, { userId: { $exists: false } }],
            },
            {
              $set: {
                email: onboardingUser.email,
                userId: onboardingUser._id,
                sessionId: null,
              },
            },
          );
        } catch (claimErr) {
          console.error("Onboarding portfolio claim failed");
        }
      }
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: "Email or username already exists (onboarding)" });
      }
      throw error;
    }
    res.status(201).json({
      user: serializeUser(onboardingUser, { includeEmail: true }),
    });
  } catch (error) {
    console.error("AddUser error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({
      users: users.map((user) => serializeUser(user, { includeEmail: true })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const self = actorId(req.user) === String(user._id);
    if (!self && !isAdmin(req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.status(200).json({
      user: serializeUser(user, { includeEmail: true }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPublicUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user: serializePublicUser(user) });
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

    console.log("fetched subscription info from stripe");
    const subscriptionList = (subscriptions.data || []).map((sub) => ({
      status: sub.status,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      plan: {
        product: {
          name: sub.plan?.product?.name || sub.plan?.nickname || null,
        },
      },
    }));
    res.status(200).json({ subscriptionList });
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

    console.log("User has a subscription");

    res.status(200).json({ hasSubscription: true });
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
    console.log("[AI-ACCESS] checking subscription for authenticated user");
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
    const selfId = actorId(req.user);
    const targetId = req.params.id ? String(req.params.id) : selfId;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await User.findById(targetId);
    if (!existing) return res.status(404).json({ message: "User not found" });

    const actorIsAdmin = isAdmin(req.user);
    if (targetId !== selfId && !actorIsAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updates = await sanitizeUserUpdate(req.body, actorIsAdmin);
    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({
      user: serializeUser(user, { includeEmail: true }),
    });
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
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const raw = body.portfolioId || body._id || body.id;
    if (!raw || !mongoose.Types.ObjectId.isValid(String(raw))) {
      return res.status(400).json({ message: "portfolioId is required" });
    }

    const link = await linkablePortfolio(String(raw), req.user);
    if (!link.ok) {
      return res.status(link.status).json({ message: link.message });
    }

    const user = await User.findByIdAndUpdate(
      userID,
      { $addToSet: { portfolios: { portfolioId: raw, portfolioType: link.portfolioType } } },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: serializeUser(user, { includeEmail: true }),
    });
  } catch (error) {
    console.error("addPortfolioID error in users.controller.js:", error);
    res.status(500).json({ message: error.message });
  }
};
