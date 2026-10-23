const Portfolio = require("../portfolios/models/Portfolio");
const {
  buildLeadCapturedEvent,
  buildSitePublishedEvent,
  buildBusinessProfileUpdatedEvent,
  buildFormSubmittedEvent,
  buildAppInstalledEvent,
  buildAppUninstalledEvent,
} = require("./webhookEvents");
const { dispatchEvent } = require("./webhookDelivery");

const inflight = new Set();

function reportFailure(label) {
  console.error(label);
}

function schedule(run, label) {
  const job = Promise.resolve()
    .then(run)
    .catch(() => reportFailure(label));
  inflight.add(job);
  job.finally(() => inflight.delete(job));
}

async function flushLifecycleEvents() {
  while (inflight.size > 0) {
    await Promise.all([...inflight]);
  }
}

async function ownerIdForSite(siteId) {
  const query = Portfolio.findById(siteId);
  if (!query) return null;
  if (typeof query.select === "function") {
    const doc = await query.select("owner").lean();
    return doc?.owner || null;
  }
  if (typeof query.lean === "function") {
    const doc = await query.lean();
    return doc?.owner || null;
  }
  const doc = await query;
  return doc?.owner || null;
}

async function dispatchLeadCaptured({ siteId, email, name, phone, createdAt }) {
  if (!siteId || typeof email !== "string" || !email.trim()) return;
  let ownerId = null;
  try {
    ownerId = await ownerIdForSite(siteId);
  } catch (_err) {
    reportFailure("lead_webhook_lookup_failed");
    return;
  }
  if (!ownerId) return;
  const event = buildLeadCapturedEvent({
    siteId,
    email: email.trim(),
    name,
    phone,
    createdAt: createdAt || new Date(),
  });
  await dispatchEvent(ownerId, event);
}

async function dispatchSitePublished({ ownerId, siteId, publishedAt }) {
  if (!ownerId || !siteId) return;
  const event = buildSitePublishedEvent({ siteId, publishedAt: publishedAt || new Date() });
  await dispatchEvent(ownerId, event);
}

function notifyLeadCaptured(fields) {
  schedule(() => dispatchLeadCaptured(fields), "lead_webhook_dispatch_failed");
}

function notifySitePublished(fields) {
  schedule(() => dispatchSitePublished(fields), "site_published_webhook_dispatch_failed");
}

async function dispatchBusinessProfileUpdated({ ownerId, siteId, profile, contact, updatedAt }) {
  if (!ownerId || !siteId) return;
  const event = buildBusinessProfileUpdatedEvent({ siteId, profile, contact, updatedAt });
  await dispatchEvent(ownerId, event);
}

async function dispatchFormSubmitted(fields) {
  if (!fields || !fields.siteId) return;
  let ownerId = fields.ownerId || null;
  if (!ownerId) {
    try {
      ownerId = await ownerIdForSite(fields.siteId);
    } catch (_err) {
      reportFailure("form_webhook_lookup_failed");
      return;
    }
  }
  if (!ownerId) return;
  const event = buildFormSubmittedEvent(fields);
  await dispatchEvent(ownerId, event);
}

async function dispatchAppInstalled(fields) {
  if (!fields || !fields.ownerId || !fields.siteId) return;
  await dispatchEvent(fields.ownerId, buildAppInstalledEvent(fields));
}

async function dispatchAppUninstalled(fields) {
  if (!fields || !fields.ownerId || !fields.siteId) return;
  await dispatchEvent(fields.ownerId, buildAppUninstalledEvent(fields));
}

function notifyBusinessProfileUpdated(fields) {
  schedule(() => dispatchBusinessProfileUpdated(fields), "business_profile_webhook_dispatch_failed");
}

function notifyFormSubmitted(fields) {
  schedule(() => dispatchFormSubmitted(fields), "form_webhook_dispatch_failed");
}

function notifyAppInstalled(fields) {
  schedule(() => dispatchAppInstalled(fields), "app_installed_webhook_dispatch_failed");
}

function notifyAppUninstalled(fields) {
  schedule(() => dispatchAppUninstalled(fields), "app_uninstalled_webhook_dispatch_failed");
}

module.exports = {
  dispatchLeadCaptured,
  dispatchSitePublished,
  dispatchBusinessProfileUpdated,
  dispatchFormSubmitted,
  dispatchAppInstalled,
  dispatchAppUninstalled,
  notifyLeadCaptured,
  notifySitePublished,
  notifyBusinessProfileUpdated,
  notifyFormSubmitted,
  notifyAppInstalled,
  notifyAppUninstalled,
  flushLifecycleEvents,
};
