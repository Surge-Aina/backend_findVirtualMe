const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { adminOnly } = require('../../legacyWriteGuard');

// Get dashboard data (public)
router.get('/', dashboardController.getDashboard);

// Update dashboard data (admin only)
router.put('/', ...adminOnly, dashboardController.updateDashboard);

// Create new dashboard (admin only)
router.post('/', ...adminOnly, dashboardController.createDashboard);

// Delete dashboard (admin only)
router.delete('/:id', ...adminOnly, dashboardController.deleteDashboard);
module.exports = router;
