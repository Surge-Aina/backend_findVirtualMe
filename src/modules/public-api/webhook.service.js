const crypto = require("crypto");
const mongoose = require("mongoose");
const { WebhookEndpoint, WebhookDelivery, WEBHOOK_EVENTS } = require("./webhookEndpoint.model");
const { encryptSecret, decryptSecret } = require("./secretBox");
const { assertPublicHttpsUrl } = require("./webhookUrls");
const { buildTestEvent } = require("./webhookEvents");
const { sendError } = require("./errors");

let attemptDeliveryFn = null;

function setAttemptDelivery(fn) {
  attemptDeliveryFn = fn;
}

const EVENT_SET = new Set(WEBHOOK_EVENTS);

class WebhookError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "WebhookError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertUserId(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new WebhookError(401, "unauthorized", "Authentication required");
  }
}

function normalizeEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new WebhookError(
      400,
      "validation_error",
      "events must list at least one supported event",
      { field: "events" }
    );
  }
  const normalized = [];
  for (const event of events) {
    if (typeof event !== "string" || !EVENT_SET.has(event)) {
      throw new WebhookError(
        400,
        "validation_error",
        "events must list supported event names",
        { field: "events" }
      );
    }
    if (!normalized.includes(event)) normalized.push(event);
  }
  return normalized;
}

function presentEndpoint(doc) {
  return {
    id: doc._id.toString(),
    url: doc.url,
    events: [...doc.events],
    secretLast4: doc.secretLast4,
    appId: doc.appId ? doc.appId.toString() : null,
    installationId: doc.installationId ? doc.installationId.toString() : null,
    createdAt: doc.createdAt,
  };
}

function newSigningSecret() {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

async function createEndpoint({ userId, url, events, appId, installationId, sealed, secretLast4 }) {
  assertUserId(userId);
  let normalizedUrl;
  try {
    normalizedUrl = assertPublicHttpsUrl(url);
  } catch (err) {
    throw new WebhookError(400, "validation_error", err.message, { field: "url" });
  }
  const normalizedEvents = normalizeEvents(events);
  const secret = sealed ? null : newSigningSecret();
  if (!sealed) {
    try {
      sealed = encryptSecret(secret);
    } catch (err) {
      if (err.code === "credential_storage_unconfigured") {
        throw new WebhookError(
          503,
          "credential_storage_unconfigured",
          "Webhook signing secrets cannot be stored until credential encryption is configured"
        );
      }
      throw err;
    }
  }

  const doc = await WebhookEndpoint.create({
    userId,
    url: normalizedUrl,
    events: normalizedEvents,
    keyVersion: sealed.keyVersion,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    authTag: sealed.authTag,
    secretLast4: secretLast4 || secret.slice(-4),
    appId: appId || null,
    installationId: installationId || null,
  });

  return { endpoint: presentEndpoint(doc), secret };
}

async function listEndpoints(userId, { installationId } = {}) {
  assertUserId(userId);
  const filter = { userId };
  if (installationId) filter.installationId = installationId;
  const docs = await WebhookEndpoint.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  return docs.map(presentEndpoint);
}

async function deleteEndpoint({ userId, endpointId, installationId }) {
  assertUserId(userId);
  if (!mongoose.isValidObjectId(endpointId)) {
    throw new WebhookError(404, "not_found", "Webhook endpoint not found");
  }
  const filter = { _id: endpointId, userId };
  if (installationId) filter.installationId = installationId;
  const doc = await WebhookEndpoint.findOneAndDelete(filter);
  if (!doc) throw new WebhookError(404, "not_found", "Webhook endpoint not found");
  await WebhookDelivery.deleteMany({ endpointId: doc._id });
  return { id: doc._id.toString(), deleted: true };
}

async function ownedEndpoint({ userId, endpointId, installationId }) {
  assertUserId(userId);
  if (!mongoose.isValidObjectId(endpointId)) {
    throw new WebhookError(404, "not_found", "Webhook endpoint not found");
  }
  const filter = { _id: endpointId, userId };
  if (installationId) filter.installationId = installationId;
  const doc = await WebhookEndpoint.findOne(filter);
  if (!doc) throw new WebhookError(404, "not_found", "Webhook endpoint not found");
  return doc;
}

function presentDelivery(doc) {
  return {
    id: doc._id.toString(),
    eventId: doc.eventId,
    type: doc.type,
    status: doc.status,
    attempts: doc.attempts,
    lastStatusCode: doc.lastStatusCode,
    nextAttemptAt: doc.nextAttemptAt,
    createdAt: doc.createdAt,
  };
}

async function rotateEndpointSecret({ userId, endpointId, installationId }) {
  const doc = await ownedEndpoint({ userId, endpointId, installationId });
  const secret = newSigningSecret();
  let sealed;
  try {
    sealed = encryptSecret(secret);
  } catch (err) {
    if (err.code === "credential_storage_unconfigured") {
      throw new WebhookError(
        503,
        "credential_storage_unconfigured",
        "Webhook signing secrets cannot be stored until credential encryption is configured"
      );
    }
    throw err;
  }
  doc.keyVersion = sealed.keyVersion;
  doc.ciphertext = sealed.ciphertext;
  doc.iv = sealed.iv;
  doc.authTag = sealed.authTag;
  doc.secretLast4 = secret.slice(-4);
  await doc.save();
  return { endpoint: presentEndpoint(doc), secret };
}

async function listDeliveries({ userId, endpointId, installationId }) {
  const doc = await ownedEndpoint({ userId, endpointId, installationId });
  const rows = await WebhookDelivery.find({ endpointId: doc._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return rows.map(presentDelivery);
}

async function sendTestEvent({ userId, endpointId, installationId }) {
  const doc = await ownedEndpoint({ userId, endpointId, installationId });
  const event = buildTestEvent(doc.events[0]);
  if (!event) throw new WebhookError(400, "validation_error", "This endpoint has no supported event");
  if (!attemptDeliveryFn) {
    throw new WebhookError(500, "internal_error", "Internal server error");
  }
  const delivery = await WebhookDelivery.create({
    endpointId: doc._id,
    userId,
    eventId: event.id,
    type: event.type,
    rawBody: JSON.stringify(event),
    status: "pending",
    attempts: 0,
    nextAttemptAt: new Date(),
    lockedUntil: new Date(Date.now() + 60_000),
  });
  try {
    await attemptDeliveryFn(delivery);
  } catch (_err) {
    console.error("webhook_test_delivery_error");
  }
  const fresh = await WebhookDelivery.findById(delivery._id).lean();
  return presentDelivery(fresh || delivery);
}

function signingSecretFor(doc) {
  return decryptSecret({
    keyVersion: doc.keyVersion,
    ciphertext: doc.ciphertext,
    iv: doc.iv,
    authTag: doc.authTag,
  });
}

function handleWebhookError(res, err) {
  if (err instanceof WebhookError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("webhook_endpoint_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

module.exports = {
  WebhookError,
  WEBHOOK_EVENTS,
  setAttemptDelivery,
  createEndpoint,
  listEndpoints,
  deleteEndpoint,
  rotateEndpointSecret,
  listDeliveries,
  sendTestEvent,
  signingSecretFor,
  handleWebhookError,
};
