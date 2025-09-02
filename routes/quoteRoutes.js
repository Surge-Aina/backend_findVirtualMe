// server/routes/quoteRoutes.js
const express = require('express');
const { createQuote, listQuotes, updateQuoteStatus } = require('../controllers/quoteController.js');
const { verifyToken, verifyAdmin } = require('../middleware/auth.js');

const router = express.Router();

// Customer can create quotes (no auth required unless you want it)
router.post('/', createQuote);

// Admin-only endpoints
router.get('/', verifyToken, verifyAdmin, listQuotes);
router.patch('/:id/status', verifyToken, verifyAdmin, updateQuoteStatus);

module.exports = router;
