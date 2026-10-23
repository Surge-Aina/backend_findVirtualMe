const mongoose = require("mongoose");

/**
 * One WalletMe pass per visitor per site. The email is not stored.
 * emailHash is sha256(pepper:siteId:email). cookieHash is sha256(cookie).
 */
const walletPassLinkSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true },
    emailHash: { type: String, required: true },
    serialNumber: { type: String, required: true },
    cookieHash: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

walletPassLinkSchema.index({ siteId: 1, emailHash: 1 }, { unique: true });

const WalletPassLink =
  mongoose.models.WalletPassLink ||
  mongoose.model("WalletPassLink", walletPassLinkSchema, "wallet_pass_links");

module.exports = WalletPassLink;
