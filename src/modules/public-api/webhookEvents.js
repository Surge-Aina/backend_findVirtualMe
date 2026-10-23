const { newEventId } = require("./webhookSignature");
const {
  LEAD_CAPTURED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
  FORM_SUBMITTED,
  APP_INSTALLED,
  APP_UNINSTALLED,
  leadCapturedFields,
  sitePublishedFields,
  businessProfileFields,
  formSubmittedFields,
  appLifecycleFields,
} = require("./webhookContract");

function iso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function optionalText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * lead.captured envelope. `id` is stable across delivery retries.
 * createdAt is the time the lead was captured.
 * Wire names come from webhookContract.js.
 */
function buildLeadCapturedEvent({ siteId, email, name, phone, createdAt, id }) {
  const capturedAt = iso(createdAt);
  const fields = leadCapturedFields;
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: LEAD_CAPTURED,
    [fields.createdAt]: capturedAt,
    [fields.data]: {
      [fields.siteId]: String(siteId),
      [fields.email]: email,
      [fields.name]: optionalText(name),
      [fields.phone]: optionalText(phone),
      [fields.capturedAt]: capturedAt,
    },
  };
}

function buildSitePublishedEvent({ siteId, publishedAt, id }) {
  const at = iso(publishedAt);
  const fields = sitePublishedFields;
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: SITE_PUBLISHED,
    [fields.createdAt]: at,
    [fields.data]: {
      [fields.siteId]: String(siteId),
      [fields.publishedAt]: at,
    },
  };
}

function buildBusinessProfileUpdatedEvent({ siteId, profile, contact, updatedAt, id }) {
  const at = iso(updatedAt);
  const fields = businessProfileFields;
  const source = profile || {};
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: BUSINESS_PROFILE_UPDATED,
    [fields.createdAt]: at,
    [fields.data]: {
      [fields.siteId]: String(siteId),
      [fields.businessName]: source.businessName || null,
      [fields.logoUrl]: source.logoUrl || null,
      [fields.brandColors]: source.brandColors || {},
      [fields.address]: source.address || null,
      [fields.contact]: contact || null,
      [fields.updatedAt]: at,
    },
  };
}

function buildFormSubmittedEvent({ siteId, form, email, name, phone, message, submittedAt, id }) {
  const at = iso(submittedAt);
  const fields = formSubmittedFields;
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: FORM_SUBMITTED,
    [fields.createdAt]: at,
    [fields.data]: {
      [fields.siteId]: String(siteId),
      [fields.form]: optionalText(form) || "contact",
      [fields.email]: optionalText(email),
      [fields.name]: optionalText(name),
      [fields.phone]: optionalText(phone),
      [fields.message]: optionalText(message),
      [fields.submittedAt]: at,
    },
  };
}

function buildAppLifecycleEvent(type, { siteId, appId, installationId, scopes, createdAt, id }) {
  const at = iso(createdAt);
  const fields = appLifecycleFields;
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: type,
    [fields.createdAt]: at,
    [fields.data]: {
      [fields.siteId]: String(siteId),
      [fields.appId]: String(appId),
      [fields.installationId]: String(installationId),
      [fields.scopes]: Array.isArray(scopes) ? [...scopes] : [],
    },
  };
}

function buildAppInstalledEvent(fields) {
  return buildAppLifecycleEvent(APP_INSTALLED, fields);
}

function buildAppUninstalledEvent(fields) {
  return buildAppLifecycleEvent(APP_UNINSTALLED, fields);
}

module.exports = {
  buildLeadCapturedEvent,
  buildSitePublishedEvent,
  buildBusinessProfileUpdatedEvent,
  buildFormSubmittedEvent,
  buildAppInstalledEvent,
  buildAppUninstalledEvent,
};
