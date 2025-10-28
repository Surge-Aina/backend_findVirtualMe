const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocalVendorPortfolio",
      required: true,
    },
    name: { type: String, required: true, default: "Undefined" },
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
    imageUrl: String, // ✅ full S3 URL
    imageKey: String, // ✅ S3 key for safe deletion
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItems", menuItemSchema);
