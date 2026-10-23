const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const PaymentNotice = require("./paymentNotice.model");
const { buildPaymentCompletedEvent } = require("./webhookEvents");
const { dispatchEvent } = require("./webhookDelivery");
const { forwardPaymentCompleted } = require("./paymentIngest.adapter");

function optionalEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function optionalPhone(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40 || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}

function siteIdFrom(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.siteId || metadata.portfolioId;
  if (typeof raw !== "string" || !mongoose.isValidObjectId(raw)) return null;
  return raw;
}

function stripeId(value) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value.id === "string") return value.id;
  return null;
}

function occurredAtFrom(created) {
  if (typeof created === "number" && Number.isFinite(created)) return new Date(created * 1000);
  return new Date();
}

function parseStripeSitePayment({ kind, object }) {
  if (!object || typeof object !== "object") return null;
  const siteId = siteIdFrom(object.metadata);
  if (!siteId) return null;
  const currency = typeof object.currency === "string" ? object.currency.trim().toLowerCase() : "";
  if (!/^[a-z]{3}$/.test(currency)) return null;

  if (kind === "payment_intent") {
    if (object.status && object.status !== "succeeded") return null;
    if (typeof object.id !== "string" || !object.id.startsWith("pi_")) return null;
    if (!Number.isInteger(object.amount) || object.amount <= 0) return null;
    return {
      siteId,
      amount: object.amount,
      currency,
      email: optionalEmail(object.receipt_email || object.metadata.email),
      phone: optionalPhone(object.metadata.phone),
      occurredAt: occurredAtFrom(object.created),
      idempotencyKey: `stripe:${object.id}`,
    };
  }

  if (kind === "checkout_session") {
    if (object.payment_status !== "paid") return null;
    if (!Number.isInteger(object.amount_total) || object.amount_total <= 0) return null;
    const paymentIntentId = stripeId(object.payment_intent);
    const sessionId = typeof object.id === "string" ? object.id : "";
    if (!paymentIntentId && !sessionId.startsWith("cs_")) return null;
    const details = object.customer_details || {};
    return {
      siteId,
      amount: object.amount_total,
      currency,
      email: optionalEmail(details.email || object.metadata.email),
      phone: optionalPhone(details.phone || object.metadata.phone),
      occurredAt: occurredAtFrom(object.created),
      idempotencyKey: paymentIntentId ? `stripe:${paymentIntentId}` : `stripe:${sessionId}`,
    };
  }

  return null;
}

async function acceptStripeSitePayment(input) {
  const parsed = parseStripeSitePayment(input || {});
  if (!parsed) return { emitted: false };
  const portfolio = await Portfolio.findById(parsed.siteId).select("owner").lean();
  if (!portfolio || !portfolio.owner) return { emitted: false };

  const event = buildPaymentCompletedEvent(parsed);
  try {
    await PaymentNotice.create({
      idempotencyKey: parsed.idempotencyKey,
      siteId: parsed.siteId,
      ownerId: portfolio.owner,
      eventId: event.id,
      amount: parsed.amount,
      currency: parsed.currency,
      occurredAt: parsed.occurredAt,
    });
  } catch (err) {
    if (err && err.code === 11000) return { emitted: false, duplicate: true };
    throw err;
  }

  await dispatchEvent(portfolio.owner, event);
  const ingest = await forwardPaymentCompleted(event);
  return { emitted: true, event, ingest };
}

module.exports = {
  parseStripeSitePayment,
  acceptStripeSitePayment,
};
