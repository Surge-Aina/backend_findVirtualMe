const mongoose = require("mongoose");

const customFieldSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformApp", default: null },
    installationId: { type: mongoose.Schema.Types.ObjectId, ref: "Installation", default: null },
    key: { type: String, required: true },
    name: { type: String, required: true },
    dataType: { type: String, required: true },
    placeholder: { type: String, default: "" },
    options: { type: [String], default: [] },
  },
  { timestamps: true }
);

customFieldSchema.index({ siteId: 1, key: 1 }, { unique: true });

const CustomField =
  mongoose.models.CustomField || mongoose.model("CustomField", customFieldSchema, "site_custom_fields");

module.exports = CustomField;
