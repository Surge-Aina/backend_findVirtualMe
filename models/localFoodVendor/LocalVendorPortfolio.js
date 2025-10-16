const mongoose = require("mongoose");

const localVendorPortfolioSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    businessType: String,
    description: String,
    logo: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "LocalVendorPortfolio",
  localVendorPortfolioSchema
);
