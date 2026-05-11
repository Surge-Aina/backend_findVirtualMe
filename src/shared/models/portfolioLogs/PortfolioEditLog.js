// models/PortfolioEditLog.js
const mongoose = require('mongoose');

const mouseInfoSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  event: { type: String, enum: ['click', 'hover', 'move'] },
  element: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const portfolioEditLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  portfolioID: { type: String },
  portfolioType: { type: String, required: true }, // e.g. 'handyman'
  action: {
    type: String,
    enum: ['created', 'updated', 'deleted'],
    default: 'created'
  },
  sessionId: { type: String },   // one log for each session id
  mouseInfo: [mouseInfoSchema],  // multiple mouse events in log
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PortfolioEditLog', portfolioEditLogSchema);

