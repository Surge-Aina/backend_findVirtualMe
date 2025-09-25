// models/handyMan/handymanPortfolioModel.js
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandymanTemplate', required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  beforeImageUrl: { type: String, required: true },
  afterImageUrl: { type: String, required: true },
  // new (optional for old docs)
  beforeImageKey: { type: String },
  afterImageKey: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('HandymanPortfolio', schema);
