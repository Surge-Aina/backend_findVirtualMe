const mongoose = require("mongoose");

/**
 * Developer API keys. The plaintext secret is never stored.
 * `prefix` is a non-secret identifier (the leading characters of the secret).
 * `keyHash` is SHA-256 of the pepper and the secret.
 */
const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, default: null, maxlength: 80 },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    scopes: { type: [String], required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

apiKeySchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ApiKey || mongoose.model("ApiKey", apiKeySchema, "api_keys");
