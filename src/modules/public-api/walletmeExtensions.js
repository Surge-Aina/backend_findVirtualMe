/**
 * Extension points for later WalletMe slices.
 *
 * Nothing in this module is mounted, persisted, or called by the public API.
 * Later slices should implement these in place rather than inventing parallel names:
 *
 * 1. Outbound `lead.captured` webhook
 *    - HMAC-SHA256 over the raw body, header
 *      `X-FindVirtualMe-Signature: t=<unix>,v1=<hex>` where v1 signs `${t}.${rawBody}`.
 *    - JSON body includes a unique `id` so WalletMe can dedupe deliveries.
 * 2. Site block `addToWallet`
 *    - A future portfolio block type. It is not in KNOWN_BLOCK_TYPES yet, so
 *      portfolios cannot save it and the agent generator will not emit it.
 *    - The block's server-side action calls WalletMe server-to-server.
 * 3. Customer-pasted WalletMe API key
 *    - Persist ciphertext only: userId, ciphertext, iv, authTag, keyVersion.
 *    - Encrypt with AES-256-GCM. Never store or log the plaintext key.
 */

const PLANNED_WEBHOOK_EVENTS = Object.freeze({
  LEAD_CAPTURED: "lead.captured",
});

const PLANNED_BLOCK_TYPES = Object.freeze({
  ADD_TO_WALLET: "addToWallet",
});

const LEAD_CAPTURED_EVENT_FIELDS = Object.freeze([
  "id",
  "type",
  "createdAt",
  "data",
]);

const WALLETME_CREDENTIAL_FIELDS = Object.freeze([
  "userId",
  "ciphertext",
  "iv",
  "authTag",
  "keyVersion",
]);

function notImplemented(feature) {
  const err = new Error(`${feature} is not available in this slice`);
  err.code = "NOT_IMPLEMENTED";
  err.status = 501;
  return err;
}

function createLeadCapturedEvent() {
  throw notImplemented("lead.captured webhook");
}

function signWebhookPayload() {
  throw notImplemented("webhook signing");
}

function storeWalletMeCredential() {
  throw notImplemented("WalletMe credential storage");
}

module.exports = {
  PLANNED_WEBHOOK_EVENTS,
  PLANNED_BLOCK_TYPES,
  LEAD_CAPTURED_EVENT_FIELDS,
  WALLETME_CREDENTIAL_FIELDS,
  createLeadCapturedEvent,
  signWebhookPayload,
  storeWalletMeCredential,
};
