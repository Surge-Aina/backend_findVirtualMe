const mongoose = require("mongoose");

const installationSchema = new mongoose.Schema(
  {
    appId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformApp", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    scopes: { type: [String], required: true },
    status: { type: String, enum: ["installed", "uninstalled"], default: "installed" },
    installedAt: { type: Date, default: () => new Date() },
    uninstalledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

installationSchema.index({ appId: 1, siteId: 1, status: 1 });

const Installation =
  mongoose.models.Installation ||
  mongoose.model("Installation", installationSchema, "app_installations");

module.exports = Installation;
