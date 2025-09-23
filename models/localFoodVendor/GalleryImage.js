const mongoose = require("mongoose");

const galleryImageSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocalVendorPortfolio",
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    caption: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("GalleryImage", galleryImageSchema);
