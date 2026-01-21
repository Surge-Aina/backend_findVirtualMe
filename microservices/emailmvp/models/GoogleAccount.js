// src/models/GoogleAccount.js
const mongoose = require("mongoose");

const googleAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    accessToken: String,
    refreshToken: String,
    scope: String,
    tokenType: String,
    expiryDate: Date,
  },
  {
    timestamps: true,
  }
);

// Avoid duplicate records per user+email
googleAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

const GoogleAccount = mongoose.model("GoogleAccount", googleAccountSchema);
module.exports = { GoogleAccount };