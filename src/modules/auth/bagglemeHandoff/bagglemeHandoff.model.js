const mongoose = require("mongoose");

const bagglemeHandoffJtiSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

bagglemeHandoffJtiSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });

module.exports = mongoose.model(
  "BagglemeHandoffJti",
  bagglemeHandoffJtiSchema,
  "baggleme_handoff_jtis",
);