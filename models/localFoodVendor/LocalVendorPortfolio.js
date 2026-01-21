const mongoose = require("mongoose");

const localVendorPortfolioSchema = new mongoose.Schema(
  {
    portfolioType: { type: String, default: "LocalVendor" },
    portfolioName: { type: String, default: "New Local Vendor Portfolio" },
    isPublic: { type: Boolean, default: false },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    businessType: String,
    description: String,
    logo: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("LocalVendorPortfolio", localVendorPortfolioSchema);
