const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    ticket: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true },
    redirectUri: { type: String, required: true },
    requestedScopes: { type: [String], default: [] },
    codeChallenge: { type: String, required: true },
    state: { type: String, default: "" },
    resource: { type: String, default: "" },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: "mcp_oauth_pending" }
);

module.exports =
  mongoose.models.McpOAuthPending || mongoose.model("McpOAuthPending", schema);