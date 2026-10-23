// routes/handymanPortfolioRoutes.js
const express = require('express');
const multer = require('multer');
const {
    getPortfolioItems,
    createPortfolioItem,
    updatePortfolioItem,
    deletePortfolioItem,
} = require('../controllers/handymanPortfolioController');

const { auth, requireHandymanTemplateOwner } = require('../../legacyWriteGuard');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', getPortfolioItems);
router.post(
    '/',
    auth,
    upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]),
    requireHandymanTemplateOwner,
    createPortfolioItem
);
router.put(
    '/:id',
    auth,
    upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]),
    requireHandymanTemplateOwner,
    updatePortfolioItem
);
router.delete('/:id', auth, requireHandymanTemplateOwner, deletePortfolioItem);

module.exports = router;
