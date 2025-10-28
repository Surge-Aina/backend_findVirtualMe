const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItems" },
  label: String,
});

const TaggedImageSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LocalVendorPortfolio",
    required: true,
  },
  imageUrl: String,
  key: String, // <-- add this for S3 cleanup
  tags: [TagSchema],
});

module.exports = mongoose.model("TaggedImage", TaggedImageSchema);
