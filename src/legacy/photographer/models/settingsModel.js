const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  portfolioId: { type: String, required: true, index: true },
  key: {
    type: String,
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
settingsSchema.index(
  { portfolioId: 1, key: 1 },
  { unique: true, name: 'portfolioId_key_unique' }
);
module.exports = mongoose.model('Settings', settingsSchema);