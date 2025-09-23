const express = require('express');
const router = express.Router();
const {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  updatePortfolio,
  getTestimonials,
  submitTestimonial
} = require('../../controllers/dataScientist/dataScientistController');

// Main portfolio routes
router.get('/', getPortfolio);

// Section-specific routes
router.post('/:section', addPortfolioItem);
router.patch('/:section/:id', updatePortfolioItem);
router.delete('/:section/:id', deletePortfolioItem);

// Update entire portfolio (must be last to avoid conflicts)
router.patch('/update', updatePortfolio);

// Testimonial routes
router.get('/testimonials', getTestimonials);
router.post('/testimonials', submitTestimonial);

module.exports = router;
