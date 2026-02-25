const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  endpoint: { type: String, required: true }, // eg. "highlights"
  position: { type: Number, default: 0 },     // for ordering
});

module.exports = mongoose.model('Photo', photoSchema);