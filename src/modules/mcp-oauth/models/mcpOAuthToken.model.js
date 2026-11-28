const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    clientId: { type: String, required: true, index: true },
    tokenFamilyId: { type: String, required: true, index: true },
    scopes: { type: [String], required: true },
    accessTokenHash: { type: String, required: true, unique: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, index: true },
    accessExpiresAt: { type: Date, required: true, index: true },
    refreshExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null, index: true },
    resource: { type: String, default: "" },
  },
  { timestamps: true, collection: "mcp_oauth_tokens" }
);

module.exports = mongoose.models.McpOAuthToken || mongoose.model("McpOAuthToken", schema);