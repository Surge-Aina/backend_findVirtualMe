const mongoose = require("mongoose");

const { EVENT_CATALOG } = require("./webhookContract");

const WEBHOOK_EVENTS = EVENT_CATALOG;

const webhookEndpointSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: { type: String, required: true },
    events: { type: [String], required: true },
    keyVersion: { type: String, required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    secretLast4: { type: String, required: true },
    appId: { type: mongoose.Schema.Types.ObjectId, default: null },
    installationId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  },
  { timestamps: true }
);

webhookEndpointSchema.index({ userId: 1, createdAt: -1 });

const webhookDeliverySchema = new mongoose.Schema(
  {
    endpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebhookEndpoint",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    rawBody: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "delivered", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastSignedAt: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: { type: Date, default: null },
    lastStatusCode: { type: Number, default: null },
  },
  { timestamps: true }
);

webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
webhookDeliverySchema.index({ eventId: 1, endpointId: 1 }, { unique: true });

const WebhookEndpoint =
  mongoose.models.WebhookEndpoint ||
  mongoose.model("WebhookEndpoint", webhookEndpointSchema, "webhook_endpoints");

const WebhookDelivery =
  mongoose.models.WebhookDelivery ||
  mongoose.model("WebhookDelivery", webhookDeliverySchema, "webhook_deliveries");

module.exports = {
  WEBHOOK_EVENTS,
  WebhookEndpoint,
  WebhookDelivery,
};
