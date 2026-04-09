const mongoose = require("mongoose");

const DataScientistContactSchema = new mongoose.Schema(
  {
    isPublic: { type: Boolean, default: false },
    portfolioType: { type: String, default: "DataScientist" },
    portfolioName: { type: String, default: "New Data Scientist Portfolio" },

    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DataScientistPortfolio",
      required: true,
    },
    ownerEmail: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
    },
    // Visitor info
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["new", "read", "replied"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DataScientistContact", DataScientistContactSchema);
