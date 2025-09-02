const express = require('express');
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController.js');
const { verifyToken, verifyAdmin } = require('../middleware/auth.js');

const router = express.Router();

router.get('/', getServices);
router.get('/:id', getServiceById);

// Admin only
router.post('/', verifyToken, verifyAdmin, createService);
router.put('/:id', verifyToken, verifyAdmin, updateService);
router.delete('/:id', verifyToken, verifyAdmin, deleteService);

module.exports = router;
