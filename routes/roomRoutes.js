const express = require('express');
const {
  getRoomPrices,
  updateRoomPrices,
  updateRoomPriceByType,
} = require('../controllers/roomController.js');
const { verifyToken, verifyAdmin } = require('../middleware/auth.js');

const router = express.Router();

router.get('/', getRoomPrices);


router.put('/', verifyToken, verifyAdmin, updateRoomPrices);


router.put('/:type', verifyToken, verifyAdmin, updateRoomPriceByType);

module.exports = router;
