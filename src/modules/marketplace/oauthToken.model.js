const mongoose = require("mongoose");

const oauthTokenSchema = new mongoose.Schema(
  {
    installationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    appId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, required: true },
    scopes: { type: [String], required: true },
    accessTokenHash: { type: String, required: true, unique: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    accessExpiresAt: { type: Date, required: true },
    refreshExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const OAuthToken =
  mongoose.models.OAuthToken || mongoose.model("OAuthToken", oauthTokenSchema, "oauth_tokens");

module.exports = OAuthToken;
