const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dataScientist/dashboardController');


// Get dashboard data (public)
router.get('/', dashboardController.getDashboard);

// Update dashboard data (admin only)
router.put('/', dashboardController.updateDashboard);

// Create new dashboard (admin only)
router.post('/', dashboardController.createDashboard);

// Delete dashboard (admin only)
router.delete('/:id', dashboardController.deleteDashboard);

module.exports = router;
