const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocalVendorPortfolio",
      required: true,
    },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true, default: 0.0 },
    category: { type: String, default: "Uncategorized" },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    unavailableUntil: {
      type: Date,
      default: null,
    },
    image: String, // optional for future use
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItems", menuItemSchema);
