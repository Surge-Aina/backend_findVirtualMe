// qrCode.model.js
const mongoose = require("mongoose");

const qrCodeSchema = new mongoose.Schema({
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  portfolioId:{ 
    type: String,
    enum: ["projectManager", "healthcare", "handyman"],
    default: null
  },
  title: { type: String, required: true },
  description: { type: String },
  url: {
    type: String,
    required: true,
    validate: {
      validator: v => /^https?:\/\/.+/.test(v),
      message: props => `${props.value} is not a valid URL!`
    }
  },
  align: { type: String, enum: ["left", "center", "right"], default: "right" },
  alignVertical: { type: String, enum: ["top", "center", "bottom"], default: "bottom" },
  size: { type: Number, default: 160 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("QrCode", qrCodeSchema);
