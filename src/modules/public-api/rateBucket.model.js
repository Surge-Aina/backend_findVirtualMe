const mongoose = require("mongoose");

/**
 * Shared fixed-window counters. Every app instance increments the same
 * MongoDB document, so the public API limit is not per process.
 */
const rateBucketSchema = new mongoose.Schema({
  bucketKey: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expireAt: { type: Date, required: true },
});

rateBucketSchema.index({ bucketKey: 1, windowStart: 1 }, { unique: true });
rateBucketSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.RateBucket ||
  mongoose.model("RateBucket", rateBucketSchema, "api_rate_buckets");
