const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  description: {
    type: [String],
    default: []
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  current: {
    type: Boolean,
    default: false
  },
  portfolioId: {
    type: String,
    default: 'datascience'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
experienceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Experience', experienceSchema);
