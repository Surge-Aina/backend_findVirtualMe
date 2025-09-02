const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['bedroom', 'kitchen', 'bathroom', 'livingRoom'],
      required: true,
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema, 'rooms');
