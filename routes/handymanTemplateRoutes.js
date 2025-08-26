const express = require('express');
const router = express.Router();
const { 
    getPortfolioById, 
    getPortfolioByUserId,
    createPortfolio, 
    updatePortfolio 
} = require('../controllers/handymanTemplateController');

// Public route to view a portfolio
router.get('/:id', getPortfolioById);

// Route to get portfolio by user id
router.get('/user/:userId', getPortfolioByUserId);

// Protected route to create a new portfolio
router.post('/', createPortfolio);

// Protected route to update a portfolio
router.put('/:id', updatePortfolio);

module.exports = router;