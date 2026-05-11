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
    key: String, // <-- Added for S3 cleanup tracking
    caption: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("GalleryImage", galleryImageSchema);
