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
} = require('../controllers/dataScientistController');
const { submitContact } = require('../controllers/dataScientistContactController');
const { adminOnly } = require('../../legacyWriteGuard');


// Main portfolio routes
router.get('/', getPortfolio);
router.post('/contact', submitContact);

// Visitor submissions. Registered before /:section so they stay public.
router.get('/testimonials', getTestimonials);
router.post('/testimonials', submitTestimonial);

// Update entire portfolio (must be last to avoid conflicts)
router.patch('/update', ...adminOnly, updatePortfolio);

// Section-specific routes
router.post('/:section', ...adminOnly, addPortfolioItem);
router.patch('/:section/:id', ...adminOnly, updatePortfolioItem);
router.delete('/:section/:id', ...adminOnly, deletePortfolioItem);

module.exports = router;
