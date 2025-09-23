const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');

// GET /api/domains - Get user's domains
router.get('/:domain', domainService.getDomain);

module.exports = router;
