const express = require('express');
const multer = require('multer');
const { getPortfolioItems, createPortfolioItem } = require('../controllers/handymanPortfolioController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', getPortfolioItems);
router.post('/', upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]), createPortfolioItem);

module.exports = router;
