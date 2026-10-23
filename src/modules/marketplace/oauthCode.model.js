const mongoose = require("mongoose");

const oauthCodeSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    appId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, required: true },
    scopes: { type: [String], required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const OAuthCode =
  mongoose.models.OAuthCode || mongoose.model("OAuthCode", oauthCodeSchema, "oauth_codes");

module.exports = OAuthCode;
