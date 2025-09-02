const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocalVendorPortfolio",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },
    description: String,
    image: String,
    shape: {
      type: String,
      enum: ["blob", "oval", "square", "fullscreen"], // you can expand this
      default: "fullscreen",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
