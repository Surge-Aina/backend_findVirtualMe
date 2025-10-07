const express = require('express');
const {
  getRoomPrices,
  updateRoomPrices,
  updateRoomPriceByType,
} = require('../controllers/roomController.js');
// const { verifyToken, verifyAdmin } = require('../middleware/auth.js');
const auth = require('../middleware/auth');
const requireAdmin = (req, res, next) =>
  req.user?.isAdmin ? next() : res.status(403).json({ message: 'Admin access only' });
const router = express.Router();

router.get('/', getRoomPrices);
router.put('/', auth, requireAdmin, updateRoomPrices);
router.put('/:type', auth, requireAdmin, updateRoomPriceByType);


// router.put('/', verifyToken, verifyAdmin, updateRoomPrices);


// router.put('/:type', verifyToken, verifyAdmin, updateRoomPriceByType);

module.exports = router;
