const express = require('express');
const { getSetting, updateSetting, getAllSettings, addSettings, deleteSettings } = require('../controllers/settingsController');

const router = express.Router();

// All routes require a portfolioId (portfolioId in query)
router.get('/', getAllSettings);
router.get('/:key', getSetting);
router.put('/:key', updateSetting);
router.post('/add', addSettings);
router.delete('/delete', deleteSettings);

module.exports = router;