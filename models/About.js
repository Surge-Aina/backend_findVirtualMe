const mongoose = require("mongoose");

const aboutSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocalVendorPortfolio",
      required: true,
    },
    banner: {
      image: String,
      title: String,
      description: String,
      shape: { type: String, default: "fullscreen" },
    },
    contentBlocks: [
      {
        heading: String,
        subheading: String,
      },
    ],
    gridImages: { type: [String], default: [] },
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model("About", aboutSchema);
