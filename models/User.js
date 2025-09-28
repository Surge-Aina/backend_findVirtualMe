const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
  portfolios: [{ type: String }],

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
      sslIssued: { type: Boolean, default: false },
      // Stripe subscription info for platform domains
      subscriptionId: { type: String },
      lastPayment: { type: Date },
      nextPayment: { type: Date },
      autoRenew: { type: Boolean, default: true },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
});

//remove password before sending back to front end
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;   // remove password when converting to JSON
    delete ret.__v;        // remove __v version field
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);