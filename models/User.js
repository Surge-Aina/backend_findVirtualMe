const mongoose = require("mongoose");

const {
  AIProjectSchema,
} = require("../microservices/aiPortfolioCreator/contact/aiPortfolioCreator.model");

const userSchema = new mongoose.Schema({
  //ai user schema merge
  userKey: { type: String, unique: true, index: true },
  displayName: { type: String, default: "Default Display Name" },
  activeProjectId: { type: String, default: "" },
  projects: { type: [AIProjectSchema], default: [] },

  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  stripeCustomerId: {
    type: String,
  },
  stripeSubscriptionId: {
    type: String,
  },
  phone: {
    type: String,
  },
  location: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
  },
  goal: {
    type: String,
  },
  industry: {
    type: String,
  },
  experienceLevel: {
    type: String,
  },
  skills: [{ type: String }],
  role: {
    type: String,
    enum: ["admin", "customer"],
    default: "customer",
  },
  practiceId: {
    type: String,
    unique: true,
  },
  portfolios: [
    {
      portfolioId: { type: mongoose.Schema.Types.ObjectId, required: true },
      portfolioType: {
        type: String,
        required: true,
        enum: ["Handyman", "LocalVendor", "CleaningLady", "ProjectManager", "Healthcare"],
      },
      isPublic: { type: Boolean, default: false },
    },
  ],
  // Domain management
  domains: [
    {
      domain: { type: String, required: true },
      portfolioId: { type: String }, // Which portfolio this domain points to
      type: {
        type: String,
        enum: ["byod", "platform"], // Bring Your Own Domain vs Platform-owned
        default: "platform",
      },
      status: {
        type: String,
        enum: ["pending", "active", "expired", "suspended"],
        default: "pending",
      },
      registeredAt: { type: Date, default: Date.now },
      expiresAt: { type: Date },
      dnsConfigured: { type: Boolean, default: false },
      // Note: SSL is automatically handled by Vercel, no need to track
      autoRenew: { type: Boolean, default: true },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: { type: Date, default: () => new Date() },
  lastLogin: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});
//remove password before sending back to front end
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password; // remove password when converting to JSON
    delete ret.__v; // remove __v version field
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
