const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPortfolioByEmail, 
        addPortfolio, 
        addPDF,
        deletePortfolioByEmail,
        editPortfolioByEmail,
        getPortfolioById,
        aiSummary} = require('../controllers/portfolioController');

const upload = multer({ storage: multer.memoryStorage() });
router.get('/email/:email', getPortfolioByEmail);
router.get('/id/:id', getPortfolioById);

router.post('/add', addPortfolio);
router.post('/upload-pdf', upload.single('resume'), addPDF);
router.post('/ai-summary', aiSummary); 

router.patch('/edit', editPortfolioByEmail);

router.delete('/delete', deletePortfolioByEmail);

module.exports = router;