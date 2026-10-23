const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { dataScientistWrite } = require('../../legacyWriteGuard');

// Get dashboard data (public)
router.get('/', dashboardController.getDashboard);

// Update dashboard data (portfolio owner or admin)
router.put('/', ...dataScientistWrite, dashboardController.updateDashboard);

// Create new dashboard (portfolio owner or admin)
router.post('/', ...dataScientistWrite, dashboardController.createDashboard);

// Delete dashboard (portfolio owner or admin)
router.delete('/:id', ...dataScientistWrite, dashboardController.deleteDashboard);
module.exports = router;
