// routes/handyMan/handymanInquiryRoutes.js
const express = require('express');
const { createInquiry } =
  require('../controllers/handymanInquiryController'); // ✅ correct

const router = express.Router();
router.post('/', createInquiry);
module.exports = router;
