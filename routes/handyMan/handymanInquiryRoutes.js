const express = require('express');
const { createInquiry } = require('../controllers/handymanInquiryController');

const router = express.Router();
router.post('/', createInquiry);

module.exports = router;
