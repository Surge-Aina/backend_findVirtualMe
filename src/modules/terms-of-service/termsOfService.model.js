const mongoose = require("mongoose");

const termsOfServiceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    portfolios: [
      {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "portfolios.type",
          required: true,
        },
        type: {
          type: String,
          enum: [
            "ProjectManagerPortfolio",
            "LocalVendorPortfolio",
            "CleaningPortfolio",
            "HealthcarePortfolio",
            "HandymanMainPortfolio",
          ],
          required: true,
        },
      },
    ],
    termsOfServiceText: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TermsOfService", termsOfServiceSchema);
