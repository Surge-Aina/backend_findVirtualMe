const express = require('express');
const { getSetting, updateSetting, getAllSettings, addSettings, deleteSettings } = require('../controllers/settingsController');
const { photographerWrite } = require('../../legacyWriteGuard');

const router = express.Router();

// All routes require a portfolioId (portfolioId in query)
router.get('/', getAllSettings);
router.get('/:key', getSetting);
router.put('/:key', ...photographerWrite, updateSetting);
router.post('/add', ...photographerWrite, addSettings);
router.delete('/delete', ...photographerWrite, deleteSettings);

module.exports = router;