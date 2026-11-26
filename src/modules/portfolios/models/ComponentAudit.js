const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Non-PII audit trail for API/MCP component writes (no config payloads or visitor data).
 */
const componentAuditSchema = new Schema(
  {
    portfolioId: { type: Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: ["add", "update", "remove", "reorder"],
      required: true,
    },
    componentId: { type: String, default: "" },
    sectionId: { type: String, default: "" },
    source: { type: String, enum: ["ai", "api"], required: true, index: true },
    authType: { type: String, enum: ["api_key", "oauth"], required: true },
    installationId: { type: Schema.Types.ObjectId, default: null },
    apiKeyId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ComponentAudit ||
  mongoose.model("ComponentAudit", componentAuditSchema, "component_audits");