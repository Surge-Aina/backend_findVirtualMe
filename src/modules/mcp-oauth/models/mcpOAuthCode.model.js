const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    scopes: { type: [String], required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    resource: { type: String, default: "" },
    tokenFamilyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mcp_oauth_codes" }
);

module.exports = mongoose.models.McpOAuthCode || mongoose.model("McpOAuthCode", schema);