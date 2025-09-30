const express = require('express');
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController.js');
// const { verifyToken, verifyAdmin } = require('../middleware/auth.js');
const auth = require('../middleware/auth');
const requireAdmin = (req, res, next) =>
  req.user?.isAdmin ? next() : res.status(403).json({ message: 'Admin access only' });
const router = express.Router();

router.get('/', getServices);
router.get('/:id', getServiceById);

// Admin only
router.post('/', auth, requireAdmin, createService);
router.put('/:id', auth, requireAdmin, updateService);
router.delete('/:id', auth, requireAdmin, deleteService);


module.exports = router;
