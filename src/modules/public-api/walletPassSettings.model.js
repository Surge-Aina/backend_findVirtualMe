const mongoose = require("mongoose");

const walletPassSettingsSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      unique: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: String, required: true },
    keyVersion: { type: String, required: true },
    keyCiphertext: { type: String, required: true },
    keyIv: { type: String, required: true },
    keyAuthTag: { type: String, required: true },
    secretLast4: { type: String, required: true },
  },
  { timestamps: true }
);

const WalletPassSettings =
  mongoose.models.WalletPassSettings ||
  mongoose.model("WalletPassSettings", walletPassSettingsSchema, "wallet_pass_settings");

module.exports = WalletPassSettings;
