const crypto = require("crypto");

/**
 * Outbound webhook signature.
 *
 * Headers on every delivery attempt:
 *   X-FindVirtualMe-Timestamp: <unix seconds>
 *   X-FindVirtualMe-Signature: v1=<lowercase hex>
 *   X-FindVirtualMe-Event: <event id>
 *
 * v1 is HMAC-SHA256 over the UTF-8 string `${timestamp}.${rawBody}`,
 * keyed with the endpoint signing secret. rawBody is the exact JSON
 * bytes of the event. Each attempt uses a new timestamp. The event id
 * stays the same across retries so receivers can dedupe.
 *
 * Receivers should reject timestamps more than 300 seconds away from
 * their clock, then compare the hex digest in constant time.
 */

const TIMESTAMP_TOLERANCE_SECONDS = 300;
const BACKOFF_MS = Object.freeze([5_000, 30_000, 120_000, 600_000, 3_600_000]);
const MAX_ATTEMPTS = 6;

function signWebhookPayload(secret, timestamp, rawBody) {
  const signed = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
}

function signatureHeader(secret, timestamp, rawBody) {
  return `v1=${signWebhookPayload(secret, timestamp, rawBody)}`;
}

function verifyWebhookSignature({ secret, timestamp, rawBody, signatureHeaderValue, nowSeconds }) {
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) return false;
  if (typeof rawBody !== "string") return false;
  if (typeof signatureHeaderValue !== "string" || !signatureHeaderValue.startsWith("v1=")) {
    return false;
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const sent = Number(timestamp);
  if (Math.abs(now - sent) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const expected = signWebhookPayload(secret, timestamp, rawBody);
  const received = signatureHeaderValue.slice(3);
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function nextBackoffMs(attemptsAfterFailure) {
  if (attemptsAfterFailure >= MAX_ATTEMPTS) return null;
  return BACKOFF_MS[Math.min(attemptsAfterFailure, BACKOFF_MS.length) - 1] ?? null;
}

function newEventId() {
  return `evt_${crypto.randomBytes(16).toString("base64url")}`;
}

module.exports = {
  TIMESTAMP_TOLERANCE_SECONDS,
  BACKOFF_MS,
  MAX_ATTEMPTS,
  signWebhookPayload,
  signatureHeader,
  verifyWebhookSignature,
  nextBackoffMs,
  newEventId,
};
