// server/routes/quoteRoutes.js
const express = require('express');
const { createQuote, listQuotes, updateQuoteStatus } = require('../controllers/quoteController.js');
// const { verifyToken, verifyAdmin } = require('../middleware/auth.js');
const auth = require('../middleware/auth');

const router = express.Router();
const requireAdmin = (req, res, next) =>
  req.user?.isAdmin ? next() : res.status(403).json({ message: 'Admin access only' });

// Customer can create quotes (no auth required unless you want it)
router.post('/', createQuote);

// Admin-only endpoints
router.get('/', auth, requireAdmin, listQuotes);
router.patch('/:id/status', auth, requireAdmin, updateQuoteStatus);

module.exports = router;
