const express = require('express');
const { getSetting, updateSetting, getAllSettings } = require('../controllers/settingsController');

const router = express.Router();

// Get all settings
router.get('/', getAllSettings);

// Get a specific setting
router.get('/:key', getSetting);

// Update a setting
router.put('/:key', updateSetting);

module.exports = router;