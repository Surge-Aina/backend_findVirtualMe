const { WebhookEndpoint, WebhookDelivery } = require("./webhookEndpoint.model");
const { signingSecretFor } = require("./webhook.service");

function loadInstallationModel() {
  try {
    return require("../marketplace/installation.model");
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") return null;
    throw err;
  }
}
const { signatureHeader, nextBackoffMs, MAX_ATTEMPTS } = require("./webhookSignature");

let sweeper = null;

function stringifyEvent(event) {
  return JSON.stringify(event);
}

async function installationAllows(endpoint, event) {
  if (!endpoint.installationId) return true;
  const Installation = loadInstallationModel();
  if (!Installation) return false;
  const installation = await Installation.findById(endpoint.installationId)
    .select("status siteId")
    .lean();
  if (!installation || installation.status !== "installed") return false;
  const siteId = event && event.data && event.data.siteId;
  if (siteId && String(installation.siteId) !== String(siteId)) return false;
  return true;
}

async function enqueueEvent(userId, event) {
  const endpoints = await WebhookEndpoint.find({
    userId,
    events: event.type,
  }).lean();
  if (endpoints.length === 0) return [];

  const rawBody = stringifyEvent(event);
  const created = [];
  for (const endpoint of endpoints) {
    if (!(await installationAllows(endpoint, event))) continue;
    try {
      const delivery = await WebhookDelivery.create({
        endpointId: endpoint._id,
        userId,
        eventId: event.id,
        type: event.type,
        rawBody,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        lockedUntil: new Date(Date.now() + 60_000),
      });
      created.push(delivery);
    } catch (err) {
      if (err && err.code === 11000) continue;
      throw err;
    }
  }
  return created;
}

async function attemptDelivery(delivery) {
  const endpoint = await WebhookEndpoint.findById(delivery.endpointId);
  if (!endpoint) {
    delivery.status = "failed";
    delivery.rawBody = "";
    delivery.lockedUntil = null;
    await delivery.save();
    return delivery;
  }

  let secret;
  try {
    secret = signingSecretFor(endpoint);
  } catch (_err) {
    console.error("webhook_secret_unavailable");
    delivery.status = "failed";
    delivery.rawBody = "";
    delivery.lockedUntil = null;
    await delivery.save();
    return delivery;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const previous = Number(delivery.lastSignedAt) || 0;
  const timestamp = String(nowSeconds > previous ? nowSeconds : previous + 1);
  delivery.lastSignedAt = Number(timestamp);
  const rawBody = delivery.rawBody;
  delivery.attempts += 1;

  let statusCode = 0;
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FindVirtualMe-Timestamp": timestamp,
        "X-FindVirtualMe-Signature": signatureHeader(secret, timestamp, rawBody),
        "X-FindVirtualMe-Event": delivery.eventId,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000),
    });
    statusCode = response.status;
  } catch (_err) {
    statusCode = 0;
  }

  delivery.lastStatusCode = statusCode;
  const ok = statusCode >= 200 && statusCode < 300;
  if (ok) {
    delivery.status = "delivered";
    delivery.rawBody = "";
    delivery.lockedUntil = null;
    await delivery.save();
    return delivery;
  }

  const delay = nextBackoffMs(delivery.attempts);
  if (delay === null || delivery.attempts >= MAX_ATTEMPTS) {
    delivery.status = "failed";
    delivery.rawBody = "";
    delivery.lockedUntil = null;
  } else {
    delivery.status = "pending";
    delivery.nextAttemptAt = new Date(Date.now() + delay);
    delivery.lockedUntil = null;
  }
  await delivery.save();
  return delivery;
}

async function dispatchEvent(userId, event) {
  const deliveries = await enqueueEvent(userId, event);
  for (const delivery of deliveries) {
    try {
      await attemptDelivery(delivery);
    } catch (_err) {
      console.error("webhook_delivery_error");
    }
  }
}

async function processDueDeliveries(limit = 20) {
  const now = new Date();
  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const delivery = await WebhookDelivery.findOneAndUpdate(
      {
        status: "pending",
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      { $set: { lockedUntil: new Date(Date.now() + 60_000) } },
      { sort: { nextAttemptAt: 1 }, new: true }
    );
    if (!delivery) break;
    try {
      await attemptDelivery(delivery);
    } catch (_err) {
      console.error("webhook_delivery_error");
    }
    processed += 1;
  }
  return processed;
}

function startWebhookSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    processDueDeliveries().catch(() => {
      console.error("webhook_sweeper_error");
    });
  }, 15_000);
  if (typeof sweeper.unref === "function") sweeper.unref();
}

function stopWebhookSweeper() {
  if (sweeper) clearInterval(sweeper);
  sweeper = null;
}

module.exports = {
  enqueueEvent,
  attemptDelivery,
  dispatchEvent,
  processDueDeliveries,
  startWebhookSweeper,
  stopWebhookSweeper,
};

require("./webhook.service").setAttemptDelivery(attemptDelivery);
