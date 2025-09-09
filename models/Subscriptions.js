const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subscriptionType: { type: String },
  paymentLog: [
    {
      payment: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  modificationLogs: [
    {
      timestamp: { type: Date, default: Date.now },
      subscriptionType: { type: String }
    }
  ],
  coupon: { type: String }
});

module.exports = mongoose.model('Subsription', SubscriptionSchema);