const mongoose = require("mongoose");

const ContactMeFormSchema = new mongoose.Schema(
  {
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolio",
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

module.exports = mongoose.model("contactMeForm", ContactMeFormSchema);
