const express = require('express');
const { getSetting, updateSetting, getAllSettings, addSettings, deleteSettings } = require('../controllers/settingsController');
const { adminOnly } = require('../../legacyWriteGuard');

const router = express.Router();

// All routes require a portfolioId (portfolioId in query)
router.get('/', getAllSettings);
router.get('/:key', getSetting);
router.put('/:key', ...adminOnly, updateSetting);
router.post('/add', ...adminOnly, addSettings);
router.delete('/delete', ...adminOnly, deleteSettings);

module.exports = router;