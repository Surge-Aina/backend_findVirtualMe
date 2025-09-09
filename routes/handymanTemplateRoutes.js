const express = require('express');
const router = express.Router();
const { 
    getPortfolioById, 
    createPortfolio, 
    updatePortfolio 
} = require('../controllers/handymanTemplateController');

// Public route to view a portfolio by its ID
router.get('/:id', getPortfolioById);

// Protected route to create a new portfolio for a user
router.post('/', createPortfolio);

// Protected route to update a portfolio by its ID
router.put('/:id', updatePortfolio);

module.exports = router;