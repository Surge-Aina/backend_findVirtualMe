const crypto = require("crypto");
const mongoose = require("mongoose");
const { WebhookEndpoint, WebhookDelivery, WEBHOOK_EVENTS } = require("./webhookEndpoint.model");
const { encryptSecret, decryptSecret } = require("./secretBox");
const { assertPublicHttpsUrl } = require("./webhookUrls");
const { sendError } = require("./errors");

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

async function createEndpoint({ userId, url, events, appId, installationId }) {
  assertUserId(userId);
  let normalizedUrl;
  try {
    normalizedUrl = assertPublicHttpsUrl(url);
  } catch (err) {
    throw new WebhookError(400, "validation_error", err.message, { field: "url" });
  }
  const normalizedEvents = normalizeEvents(events);
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

  const doc = await WebhookEndpoint.create({
    userId,
    url: normalizedUrl,
    events: normalizedEvents,
    keyVersion: sealed.keyVersion,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    authTag: sealed.authTag,
    secretLast4: secret.slice(-4),
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
  createEndpoint,
  listEndpoints,
  deleteEndpoint,
  signingSecretFor,
  handleWebhookError,
};
