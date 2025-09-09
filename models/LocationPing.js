const mongoose = require("mongoose");

const LocationPingSchema = new mongoose.Schema({
  // Optional: logged-in user id (null if anonymous)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: false },

  // City-level only (no precise lat/lng stored)
  city: String,
  region: String,
  country: String,

  // Where this happened
  page: String,

  // Business timestamp
  ts: { type: Date, default: Date.now },

  // For TTL auto expiration
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete docs after 15 days (1296000 seconds)
LocationPingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 15 });

module.exports = mongoose.model("LocationPing", LocationPingSchema);
