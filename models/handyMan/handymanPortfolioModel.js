// models/handymanPortfolioModel.js
const mongoose = require('mongoose');

const handymanPortfolioSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'HandymanTemplate', required: true }, // ⬅ add this
  title: { type: String, required: true },
  category: { type: String, required: true },
  beforeImageUrl: { type: String, required: true },
  afterImageUrl: { type: String, required: true },
}, {
  timestamps: true,
  collection: 'handymanportfolios'
});

module.exports = mongoose.model('HandymanPortfolio', handymanPortfolioSchema);
