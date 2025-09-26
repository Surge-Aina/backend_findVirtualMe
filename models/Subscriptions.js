const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    name: { type: String },
    customerId: { type: String, required: true, unique: true }, // Stripe customer ID
    subscriptionId: { type: String, required: true }, // Stripe subscription ID

    // Current subscription details
    priceId: { type: String }, // Current active price ID
    subscriptionType: { type: String }, // 'basic', 'pro'

    // Subscription status
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"],
      default: "trialing",
    },

    // Billing details
    latestInvoiceId: { type: String },
    paymentIntentId: { type: String },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date },

    // Subscription items
    subscriptionItems: [
      {
        itemId: { type: String }, // Stripe subscription item ID (si_xxx)
        priceId: { type: String },
        quantity: { type: Number, default: 1 },
        active: { type: Boolean, default: true },
      },
    ],

    // Payment history
    paymentLog: [
      {
        paymentIntentId: { type: String },
        chargeId: { type: String },
        invoiceId: { type: String },
        amount: { type: Number },
        currency: { type: String },
        confirmed: { type: Boolean },
        subscriptionType: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Modification history
    modificationLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        subscriptionType: { type: String },
        status: { type: String },
        priceId: { type: String },
        action: { type: String }, // 'created', 'updated', 'canceled', 'reactivated'
        metadata: { type: mongoose.Schema.Types.Mixed }, // Additional details
      },
    ],

    //refunds
    refundLog: [
      {
        refundId: { type: String }, // re_...
        chargeId: { type: String }, // ch_...
        amount: { type: Number },
        currency: { type: String },
        reason: { type: String },
        status: { type: String }, // succeeded, pending, failed
        subscriptionCanceled: { type: Boolean },
        source: { type: String }, // 'admin_panel', 'dashboard', 'automatic'
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Discounts and coupons
    coupon: { type: String },
    discountEnd: { type: Date },

    trialEnd: { type: Date },
    defaultPaymentMethodId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
