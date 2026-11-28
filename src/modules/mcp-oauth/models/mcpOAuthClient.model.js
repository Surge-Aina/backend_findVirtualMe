const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecretHash: { type: String, default: "" },
    clientName: { type: String, default: "" },
    redirectUris: { type: [String], default: [] },
    tokenEndpointAuthMethod: { type: String, default: "none" },
    grantTypes: { type: [String], default: ["authorization_code", "refresh_token"] },
    responseTypes: { type: [String], default: ["code"] },
    source: { type: String, enum: ["dcr", "metadata"], default: "dcr" },
    metadataUrl: { type: String, default: "" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mcp_oauth_clients" }
);

module.exports = mongoose.models.McpOAuthClient || mongoose.model("McpOAuthClient", schema);