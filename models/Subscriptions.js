const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  customerId: { type: String },
  priceId: { type: String },
  active: { type: Boolean },
  subscriptionType: { type: String },
  paymentLog: [
    {
      payment: { type: String },
      confirmed: {type: Boolean},
      subscriptionType: { type: String },
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