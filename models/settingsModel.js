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

module.exports = mongoose.model('Settings', settingsSchema);