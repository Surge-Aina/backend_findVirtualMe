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
const WORKFLOW_TRIGGER_FIRED = "workflow.trigger.fired";

const EVENT_CATALOG = Object.freeze([
  LEAD_CAPTURED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
  FORM_SUBMITTED,
  APP_INSTALLED,
  APP_UNINSTALLED,
  WORKFLOW_TRIGGER_FIRED,
]);

const leadCapturedFields = Object.freeze({
  id: "id",
  type: "type",
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  email: "email",
  name: "name",
  phone: "phone",
  capturedAt: "createdAt",
});

const sitePublishedFields = Object.freeze({
  id: "id",
  type: "type",
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  publishedAt: "publishedAt",
});

const LEAD_CAPTURED_ENVELOPE_FIELDS = Object.freeze([
  leadCapturedFields.id,
  leadCapturedFields.type,
  leadCapturedFields.createdAt,
  leadCapturedFields.data,
]);

const LEAD_CAPTURED_DATA_FIELDS = Object.freeze([
  leadCapturedFields.siteId,
  leadCapturedFields.email,
  leadCapturedFields.name,
  leadCapturedFields.phone,
  leadCapturedFields.capturedAt,
]);

const SITE_PUBLISHED_DATA_FIELDS = Object.freeze([
  sitePublishedFields.siteId,
  sitePublishedFields.publishedAt,
]);

const businessProfileFields = Object.freeze({
  id: "id",
  type: "type",
  createdAt: "createdAt",
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
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  form: "form",
  email: "email",
  name: "name",
  phone: "phone",
  message: "message",
  submittedAt: "submittedAt",
});

const workflowTriggerFields = Object.freeze({
  id: "id",
  type: "type",
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  triggerId: "triggerId",
  triggerKey: "triggerKey",
  payload: "payload",
});

const appLifecycleFields = Object.freeze({
  id: "id",
  type: "type",
  createdAt: "createdAt",
  data: "data",
  siteId: "siteId",
  appId: "appId",
  installationId: "installationId",
  scopes: "scopes",
});

module.exports = {
  LEAD_CAPTURED,
  SITE_PUBLISHED,
  BUSINESS_PROFILE_UPDATED,
  FORM_SUBMITTED,
  APP_INSTALLED,
  APP_UNINSTALLED,
  WORKFLOW_TRIGGER_FIRED,
  EVENT_CATALOG,
  leadCapturedFields,
  sitePublishedFields,
  businessProfileFields,
  formSubmittedFields,
  appLifecycleFields,
  workflowTriggerFields,
  LEAD_CAPTURED_ENVELOPE_FIELDS,
  LEAD_CAPTURED_DATA_FIELDS,
  SITE_PUBLISHED_DATA_FIELDS,
};
