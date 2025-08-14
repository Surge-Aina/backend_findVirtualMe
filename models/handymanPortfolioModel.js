const mongoose = require('mongoose');

const handymanPortfolioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  beforeImageUrl: { type: String, required: true },
  afterImageUrl: { type: String, required: true },
}, { 
  timestamps: true,
  collection: 'handymanportfolios' // Add this line
});

const HandymanPortfolio = mongoose.model('HandymanPortfolio', handymanPortfolioSchema);

module.exports = HandymanPortfolio;