const mongoose = require('mongoose');

const dashboardSchema = new mongoose.Schema({
  chartTitle: {
    type: String,
    default: 'Revenue Trend'
  },
  xAxisLabel: {
    type: String,
    default: 'Months'
  },
  yAxisLabel: {
    type: String,
    default: 'Revenue ($)'
  },
  data: {
    sales: [Number],
    revenue: [Number],
    xLabels: [String],
    hiddenPoints: [Number]
  },
  categories: {
    type: [String],
    default: ['Electronics', 'Clothing', 'Books', 'Home', 'Sports']
  },
  categoryData: {
    type: [Number],
    default: [35, 25, 20, 15, 5]
  },
  isActive: {
    type: Boolean,
    default: true
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
dashboardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Dashboard', dashboardSchema);
