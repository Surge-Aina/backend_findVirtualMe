    const express = require('express');
    const jwt = require('jsonwebtoken');
    const router = express.Router();

    const {
    getPortfolioById,
    createPortfolio,
    updatePortfolio,
    listPortfolios,
    } = require('../../controllers/handyman/handymanTemplateController');

    // Minimal local auth middleware for these routes only
    function requireAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // normalize to { id, userId } to match controller usage
        req.user = { id: payload.id || payload.userId, userId: payload.id || payload.userId };
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    }

    router.get('/', listPortfolios);
    // Public: anyone can view a portfolio
    router.get('/:id', getPortfolioById);

    // Owner-only: must be logged in
    router.post('/', requireAuth, createPortfolio);
    router.put('/:id', requireAuth, updatePortfolio);

    module.exports = router;
