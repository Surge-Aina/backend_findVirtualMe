const Room = require('../models/roomModel.js');

const ALLOWED_TYPES = ['bedroom', 'kitchen', 'bathroom', 'livingRoom'];

const isValidPrice = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
};


const getRoomPrices = async (_req, res) => {
  try {
    const rooms = await Room.find({});
    return res.json(rooms);
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch room prices', error: err.message });
  }
};


const updateRoomPrices = async (req, res) => {
  try {
    const updates = req.body ?? {};

    
    for (const [type, value] of Object.entries(updates)) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({ message: `Unknown room type: ${type}` });
      }
      if (!isValidPrice(value)) {
        return res
          .status(400)
          .json({ message: `Invalid price for ${type}: must be a non-negative number` });
      }
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ message: 'No room prices provided' });
    }

    
    const updatedDocs = await Promise.all(
      keys.map(async (type) => {
        const price = Number(updates[type]);
        const doc = await Room.findOneAndUpdate(
          { type },
          { $set: { type, price } },
          { new: true, upsert: true, runValidators: true }
        );
        return doc;
      })
    );

   
    const byType = Object.fromEntries(updatedDocs.map((d) => [d.type, d]));
    const sorted = ALLOWED_TYPES.filter((t) => byType[t]).map((t) => byType[t]);

    return res.status(200).json(sorted);
  } catch (err) {
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('PUT /rooms error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to update room prices', error: err.message });
  }
};


const updateRoomPriceByType = async (req, res) => {
  try {
    const { type } = req.params;
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: `Unknown room type: ${type}` });
    }

    const { price } = req.body ?? {};
    if (!isValidPrice(price)) {
      return res
        .status(400)
        .json({ message: `Invalid price for ${type}: must be a non-negative number` });
    }

    const doc = await Room.findOneAndUpdate(
      { type },
      { $set: { type, price: Number(price) } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json(doc);
  } catch (err) {
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    console.error(`PUT /rooms/${req.params?.type} error:`, err);
    return res
      .status(500)
      .json({ message: 'Failed to update room price', error: err.message });
  }
};



module.exports = { getRoomPrices, updateRoomPrices, updateRoomPriceByType };
