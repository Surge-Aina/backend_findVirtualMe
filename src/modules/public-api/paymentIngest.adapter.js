const PlatformApp = require("../marketplace/app.model");
const Installation = require("../marketplace/installation.model");

/**
 * Payment ingest for an installed app named WalletMe.
 * Wallet Hub API 0.18.0 does not publish a payment-ingest operation, so this
 * adapter never performs an HTTP call. WALLETME_PAYMENT_INGEST_ENABLED defaults off.
 * The signed payment.completed event is the contract any installed app receives.
 */
const APP_SLUG = "walletme";

function ingestEnabled() {
  return process.env.WALLETME_PAYMENT_INGEST_ENABLED === "true";
}

async function forwardPaymentCompleted(event) {
  const siteId = event && event.data && event.data.siteId;
  if (!siteId) return { forwarded: false, reason: "not_installed" };
  const app = await PlatformApp.findOne({ slug: APP_SLUG }).select("_id").lean();
  if (!app) return { forwarded: false, reason: "not_installed" };
  const installation = await Installation.findOne({
    appId: app._id,
    siteId,
    status: "installed",
  })
    .select("_id")
    .lean();
  if (!installation) return { forwarded: false, reason: "not_installed" };
  if (!ingestEnabled()) return { forwarded: false, reason: "disabled" };
  // No payment-ingest operation is published, so the enabled flag still does not call out.
  return { forwarded: false, reason: "endpoint_unpublished" };
}

module.exports = {
  APP_SLUG,
  forwardPaymentCompleted,
};
