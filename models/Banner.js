const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    image: String,
    shape: {
      type: String,
      enum: ["blob", "oval", "square", "fullscreen"], // you can expand this
      default: "blob",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
