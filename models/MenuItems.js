const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
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
