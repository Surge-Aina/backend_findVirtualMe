// routes/handymanPortfolioRoutes.js
const express = require('express');
const multer = require('multer');
<<<<<<< HEAD:routes/handyMan/handymanPortfolioRoutes.js
const { getPortfolioItems, createPortfolioItem } = require('../../controllers/handyman/handymanPortfolioController');
=======
const {
    getPortfolioItems,
    createPortfolioItem,
    updatePortfolioItem,
    deletePortfolioItem,
} = require('../controllers/handymanPortfolioController');
>>>>>>> 67878f7 (Initial Commit for feature one):routes/handymanPortfolioRoutes.js

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
