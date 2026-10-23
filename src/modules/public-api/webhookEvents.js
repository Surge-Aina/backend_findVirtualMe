const { newEventId } = require("./webhookSignature");
const { parseConsent } = require("./leadConsent");
const {
  API_VERSION,
  SUBSCRIBER_CONTEXT_EVENTS,
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

const subscriberTypes = new Set(SUBSCRIBER_CONTEXT_EVENTS);

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

/** Visitor email is copied exactly as submitted. It is not trimmed or lowercased. */
function exactEmail(value) {
  return typeof value === "string" ? value : null;
}

function leadIdValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function subscriberEnvelope(fields, type, createdAt, data) {
  return {
    [fields.id]: data.eventId || newEventId(),
    [fields.type]: type,
    [fields.apiVersion]: API_VERSION,
    [fields.createdAt]: createdAt,
    [fields.appId]: null,
    [fields.installationId]: null,
    [fields.data]: data.body,
  };
}

/**
 * Copy a built event for one subscription.
 * Lead, form, site, and profile deliveries carry that subscription's
 * appId and installationId, or null when the subscription is account-level.
 * The event id stays the same across subscriptions and retries.
 */
function eventForSubscription(event, endpoint) {
  if (!event || typeof event !== "object") return event;
  const next = { ...event, apiVersion: API_VERSION };
  if (!subscriberTypes.has(event.type)) return next;
  return {
    ...next,
    appId: endpoint && endpoint.appId ? String(endpoint.appId) : null,
    installationId: endpoint && endpoint.installationId ? String(endpoint.installationId) : null,
  };
}

/**
 * lead.captured envelope. `id` is stable across delivery retries.
 * createdAt is the time the lead was captured.
 * Wire names come from webhookContract.js.
 */
function buildLeadCapturedEvent({ siteId, leadId, email, name, phone, consent, createdAt, id }) {
  const capturedAt = iso(createdAt);
  const fields = leadCapturedFields;
  const event = subscriberEnvelope(fields, LEAD_CAPTURED, capturedAt, {
    eventId: id,
    body: {
      [fields.leadId]: leadIdValue(leadId),
      [fields.siteId]: String(siteId),
      [fields.email]: exactEmail(email),
      [fields.name]: optionalText(name),
      [fields.phone]: optionalText(phone),
      [fields.consent]: parseConsent(consent),
      [fields.capturedAt]: capturedAt,
    },
  });
  return event;
}

function buildSitePublishedEvent({ siteId, publishedAt, id }) {
  const at = iso(publishedAt);
  const fields = sitePublishedFields;
  return subscriberEnvelope(fields, SITE_PUBLISHED, at, {
    eventId: id,
    body: {
      [fields.siteId]: String(siteId),
      [fields.publishedAt]: at,
    },
  });
}

function buildBusinessProfileUpdatedEvent({ siteId, profile, contact, updatedAt, id }) {
  const at = iso(updatedAt);
  const fields = businessProfileFields;
  const source = profile || {};
  return subscriberEnvelope(fields, BUSINESS_PROFILE_UPDATED, at, {
    eventId: id,
    body: {
      [fields.siteId]: String(siteId),
      [fields.businessName]: source.businessName || null,
      [fields.logoUrl]: source.logoUrl || null,
      [fields.brandColors]: source.brandColors || {},
      [fields.address]: source.address || null,
      [fields.contact]: contact || null,
      [fields.updatedAt]: at,
    },
  });
}

function buildFormSubmittedEvent({ siteId, leadId, form, email, name, phone, message, consent, submittedAt, id }) {
  const at = iso(submittedAt);
  const fields = formSubmittedFields;
  return subscriberEnvelope(fields, FORM_SUBMITTED, at, {
    eventId: id,
    body: {
      [fields.leadId]: leadIdValue(leadId),
      [fields.siteId]: String(siteId),
      [fields.form]: optionalText(form) || "contact",
      [fields.email]: exactEmail(email),
      [fields.name]: optionalText(name),
      [fields.phone]: optionalText(phone),
      [fields.message]: optionalText(message),
      [fields.consent]: parseConsent(consent),
      [fields.submittedAt]: at,
    },
  });
}

function buildAppLifecycleEvent(type, { siteId, appId, installationId, scopes, createdAt, id }) {
  const at = iso(createdAt);
  const fields = appLifecycleFields;
  return {
    [fields.id]: id || newEventId(),
    [fields.type]: type,
    [fields.apiVersion]: API_VERSION,
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

function buildTestEvent(type) {
  const siteId = "000000000000000000000000";
  const at = new Date();
  if (type === LEAD_CAPTURED) {
    return buildLeadCapturedEvent({
      siteId,
      leadId: siteId,
      email: "webhook-test@example.test",
      consent: null,
      createdAt: at,
    });
  }
  if (type === FORM_SUBMITTED) {
    return buildFormSubmittedEvent({
      siteId,
      leadId: siteId,
      form: "test",
      message: "Webhook test",
      consent: null,
      submittedAt: at,
    });
  }
  if (type === SITE_PUBLISHED) return buildSitePublishedEvent({ siteId, publishedAt: at });
  if (type === BUSINESS_PROFILE_UPDATED) {
    return buildBusinessProfileUpdatedEvent({
      siteId,
      profile: { businessName: "Webhook test", logoUrl: null, brandColors: {}, address: null },
      contact: null,
      updatedAt: at,
    });
  }
  if (type === APP_INSTALLED || type === APP_UNINSTALLED) {
    return buildAppLifecycleEvent(type, {
      siteId,
      appId: "000000000000000000000000",
      installationId: "000000000000000000000000",
      scopes: [],
      createdAt: at,
    });
  }
  return null;
}

module.exports = {
  eventForSubscription,
  buildLeadCapturedEvent,
  buildSitePublishedEvent,
  buildBusinessProfileUpdatedEvent,
  buildFormSubmittedEvent,
  buildAppInstalledEvent,
  buildAppUninstalledEvent,
  buildTestEvent,
};
