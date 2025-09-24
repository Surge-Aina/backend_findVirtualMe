// routes/handymanPortfolioRoutes.js
const express = require('express');
const multer = require('multer');
const {
    getPortfolioItems,
    createPortfolioItem,
    updatePortfolioItem,
    deletePortfolioItem,
} = require('../../controllers/handyman/handymanPortfolioController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', getPortfolioItems);
router.post(
    '/',
    upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]),
    createPortfolioItem
);
router.put(
    '/:id',
    upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]),
    updatePortfolioItem
);
router.delete('/:id', deletePortfolioItem);

module.exports = router;
