const mongoose = require('mongoose');

const QuoteRequestSchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: true
  },
  services: [{
    type: String,
    required: true
  }],
  details: {
    type: String,
    default: ''
  },
  dueDate: {
    type: Date,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'completed', 'rejected'],
    default: 'new'
  }
}, { timestamps: true });

module.exports = mongoose.model('QuoteRequest', QuoteRequestSchema);