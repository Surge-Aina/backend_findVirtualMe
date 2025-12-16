// models/DomainRewrite.js
const mongoose = require("mongoose");

const domainRewriteSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  portfolioId: {
    type: String,
    required: true,
  },
  portfolioPath: {
    type: String,
    required: true,
  }, // e.g., "/portfolios/handyman/ID-123"
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["active", "pending", "inactive"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast lookups
domainRewriteSchema.index({ domain: 1, status: 1 });

module.exports = mongoose.model("DomainRewrite", domainRewriteSchema);
