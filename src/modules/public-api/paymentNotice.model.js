const mongoose = require("mongoose");

const paymentNoticeSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Portfolio", required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const PaymentNotice =
  mongoose.models.PaymentNotice ||
  mongoose.model("PaymentNotice", paymentNoticeSchema, "payment_notices");

module.exports = PaymentNotice;
