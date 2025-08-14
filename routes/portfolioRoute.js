const express = require('express');
const router = express.Router();
const { getPortfolioByEmail, 
        addPortfolio, 
        deletePortfolioByEmail,
        editPortfolioByEmail,
        getPortfolioById} = require('../controllers/portfolioController');

router.get('/email/:email', getPortfolioByEmail);
router.get('/id/:id', getPortfolioById);

router.post('/add', addPortfolio);

// Temporarily disabled to debug routing issue
// router.patch('/edit', editPortfolioByEmail);

router.delete('/delete', deletePortfolioByEmail);

module.exports = router;