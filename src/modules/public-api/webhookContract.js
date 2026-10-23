/**
 * Outbound event catalog. Wire names live in this module.
 * Builders and the OpenAPI examples use these strings.
 */

const LEAD_CAPTURED = "lead.captured";
const SITE_PUBLISHED = "site.published";
const BUSINESS_PROFILE_UPDATED = "business_profile.updated";
const FORM_SUBMITTED = "form.submitted";
const APP_INSTALLED = "app.installed";
const APP_UNINSTALLED = "app.uninstalled";

/** Date the current outbound payload shape was published. */
const API_VERSION = "2026-10-23";
const API_VERSION_HEADER = "X-FindVirtualMe-Api-Version";

const EVENT_CATALOG = Object.freeze([
  LEAD_CAPTURED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
  FORM_SUBMITTED,
  APP_INSTALLED,
  APP_UNINSTALLED,
]);

/** Events whose delivering subscription may belong to a marketplace installation. */
const SUBSCRIBER_CONTEXT_EVENTS = Object.freeze([
  LEAD_CAPTURED,
  FORM_SUBMITTED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
]);

const leadCapturedFields = Object.freeze({
  id: "id",
  type: "type",
  apiVersion: "apiVersion",
  createdAt: "createdAt",
  appId: "appId",
  installationId: "installationId",
  data: "data",
  leadId: "leadId",
  siteId: "siteId",
  email: "email",
  name: "name",
  phone: "phone",
  consent: "consent",
  capturedAt: "createdAt",
});

const sitePublishedFields = Object.freeze({
  id: "id",
  type: "type",
  apiVersion: "apiVersion",
  createdAt: "createdAt",
  appId: "appId",
  installationId: "installationId",
  data: "data",
  siteId: "siteId",
  publishedAt: "publishedAt",
});

const LEAD_CAPTURED_ENVELOPE_FIELDS = Object.freeze([
  leadCapturedFields.id,
  leadCapturedFields.type,
  leadCapturedFields.apiVersion,
  leadCapturedFields.createdAt,
  leadCapturedFields.appId,
  leadCapturedFields.installationId,
  leadCapturedFields.data,
]);

const LEAD_CAPTURED_DATA_FIELDS = Object.freeze([
  leadCapturedFields.leadId,
  leadCapturedFields.siteId,
  leadCapturedFields.email,
  leadCapturedFields.name,
  leadCapturedFields.phone,
  leadCapturedFields.consent,
  leadCapturedFields.capturedAt,
]);

const SITE_PUBLISHED_DATA_FIELDS = Object.freeze([
  sitePublishedFields.siteId,
  sitePublishedFields.publishedAt,
]);

const businessProfileFields = Object.freeze({
  id: "id",
  type: "type",
  apiVersion: "apiVersion",
  createdAt: "createdAt",
  appId: "appId",
  installationId: "installationId",
  data: "data",
  siteId: "siteId",
  businessName: "businessName",
  logoUrl: "logoUrl",
  brandColors: "brandColors",
  address: "address",
  contact: "contact",
  updatedAt: "updatedAt",
});

const formSubmittedFields = Object.freeze({
  id: "id",
  type: "type",
  apiVersion: "apiVersion",
  createdAt: "createdAt",
  appId: "appId",
  installationId: "installationId",
  data: "data",
  leadId: "leadId",
  siteId: "siteId",
  form: "form",
  email: "email",
  name: "name",
  phone: "phone",
  message: "message",
  consent: "consent",
  submittedAt: "submittedAt",
});

const appLifecycleFields = Object.freeze({
  id: "id",
  type: "type",
  apiVersion: "apiVersion",
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  appId: "appId",
  installationId: "installationId",
  scopes: "scopes",
});

module.exports = {
  API_VERSION,
  API_VERSION_HEADER,
  LEAD_CAPTURED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
  FORM_SUBMITTED,
  APP_INSTALLED,
  APP_UNINSTALLED,
  EVENT_CATALOG,
  SUBSCRIBER_CONTEXT_EVENTS,
  leadCapturedFields,
  sitePublishedFields,
  businessProfileFields,
  formSubmittedFields,
  appLifecycleFields,
  LEAD_CAPTURED_ENVELOPE_FIELDS,
  LEAD_CAPTURED_DATA_FIELDS,
  SITE_PUBLISHED_DATA_FIELDS,
};
