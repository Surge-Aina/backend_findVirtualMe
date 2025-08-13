const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    feedback: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    image: {
      type: String,
      default: "X",
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
