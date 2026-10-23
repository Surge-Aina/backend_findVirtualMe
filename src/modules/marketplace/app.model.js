const mongoose = require("mongoose");

const appSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    clientId: { type: String, required: true, unique: true },
    clientSecretHash: { type: String, required: true },
    secretLast4: { type: String, required: true },
    redirectUris: { type: [String], required: true },
    scopes: { type: [String], required: true },
    webhookUrl: { type: String, default: "" },
    webhookKeyVersion: { type: String, default: "" },
    webhookCiphertext: { type: String, default: "" },
    webhookIv: { type: String, default: "" },
    webhookAuthTag: { type: String, default: "" },
    webhookSecretLast4: { type: String, default: "" },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const PlatformApp =
  mongoose.models.PlatformApp || mongoose.model("PlatformApp", appSchema, "platform_apps");

module.exports = PlatformApp;
