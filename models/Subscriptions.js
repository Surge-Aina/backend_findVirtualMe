const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  customerId: { type: String }, // Stripe customer ID
  subscriptionId: { type: String, unique: true }, // Stripe subscription ID
  priceId: { type: String }, // Stripe price ID
  latestInvoiceId: { type: String },
  paymentIntentId: { type: String },
  status: { 
    type: String, 
    enum: ['trialing','active','past_due','canceled','unpaid'], 
    default: 'trialing' 
  },
  subscriptionType: { type: String },
  paymentLog: [
    {
      paymentIntentId: { type: String },
      amount: { type: Number },
      currency: { type: String },
      confirmed: { type: Boolean },
      subscriptionType: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  modificationLogs: [
    {
      timestamp: { type: Date, default: Date.now },
      subscriptionType: { type: String },
      status: { type: String }
    }
  ],
  coupon: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
