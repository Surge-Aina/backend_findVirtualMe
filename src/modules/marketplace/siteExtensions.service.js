const mongoose = require("mongoose");
const crypto = require("crypto");
const Portfolio = require("../portfolios/models/Portfolio");
const CustomField = require("./customField.model");
const WorkflowAction = require("./workflowAction.model");
const WorkflowTrigger = require("./workflowTrigger.model");
const { assertPublicHttpsUrl } = require("../public-api/webhookUrls");
const { encryptSecret, decryptSecret } = require("../public-api/secretBox");
const { signatureHeader, newEventId } = require("../public-api/webhookSignature");
const { notifyWorkflowTriggerFired } = require("../public-api/lifecycleEvents");

const DATA_TYPES = Object.freeze([
  "text",
  "large_text",
  "number",
  "phone",
  "checkbox",
  "single_option",
  "multi_option",
  "date",
]);
const OPTION_TYPES = new Set(["single_option", "multi_option"]);
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,40}$/;

class ExtensionsError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ExtensionsError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function callerFilter(req) {
  if (req.publicApi.authType === "oauth") {
    return { appId: req.publicApi.appId };
  }
  return { appId: null, userId: req.publicApi.user._id };
}

async function assertOwnedSite(req, siteId) {
  if (!mongoose.isValidObjectId(siteId)) {
    throw new ExtensionsError(404, "not_found", "Site not found");
  }
  if (req.publicApi.authType === "oauth" && String(req.publicApi.siteId) !== String(siteId)) {
    throw new ExtensionsError(404, "not_found", "Site not found");
  }
  const site = await Portfolio.findOne({ _id: siteId, owner: req.publicApi.user._id }).select("_id").lean();
  if (!site) throw new ExtensionsError(404, "not_found", "Site not found");
  return site;
}

function cleanKey(value, field) {
  if (typeof value !== "string" || !KEY_PATTERN.test(value)) {
    throw new ExtensionsError(400, "validation_error", `${field} is invalid`, { field });
  }
  return value;
}

function cleanName(value, field) {
  if (typeof value !== "string") {
    throw new ExtensionsError(400, "validation_error", `${field} must be a string`, { field });
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new ExtensionsError(400, "validation_error", `${field} is invalid`, { field });
  }
  return trimmed;
}

function cleanDescription(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 300) {
    throw new ExtensionsError(400, "validation_error", "description is invalid", { field: "description" });
  }
  return value.trim();
}

function cleanPayload(value, field) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExtensionsError(400, "validation_error", `${field} must be an object`, { field });
  }
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch (_err) {
    throw new ExtensionsError(400, "validation_error", `${field} must be an object`, { field });
  }
  if (encoded.length > 8192) {
    throw new ExtensionsError(400, "validation_error", `${field} is too large`, { field });
  }
  return JSON.parse(encoded);
}

function presentField(doc) {
  return {
    id: doc._id.toString(),
    siteId: doc.siteId.toString(),
    key: doc.key,
    name: doc.name,
    dataType: doc.dataType,
    placeholder: doc.placeholder || "",
    options: [...(doc.options || [])],
  };
}

function presentAction(doc) {
  return {
    id: doc._id.toString(),
    siteId: doc.siteId.toString(),
    key: doc.key,
    name: doc.name,
    description: doc.description || "",
    targetUrl: doc.targetUrl,
    secretLast4: doc.secretLast4,
  };
}

function presentTrigger(doc) {
  return {
    id: doc._id.toString(),
    siteId: doc.siteId.toString(),
    key: doc.key,
    name: doc.name,
    description: doc.description || "",
    samplePayload: doc.samplePayload || {},
  };
}

async function listCustomFields(req, siteId) {
  await assertOwnedSite(req, siteId);
  const docs = await CustomField.find({ siteId, ...callerFilter(req) }).sort({ key: 1 }).limit(100).lean();
  return docs.map(presentField);
}

async function createCustomField(req, siteId, body) {
  await assertOwnedSite(req, siteId);
  const key = cleanKey(body?.key, "key");
  const name = cleanName(body?.name, "name");
  if (!DATA_TYPES.includes(body?.dataType)) {
    throw new ExtensionsError(400, "validation_error", "dataType is invalid", { field: "dataType" });
  }
  let placeholder = "";
  if (body?.placeholder !== undefined && body.placeholder !== null && body.placeholder !== "") {
    placeholder = cleanName(body.placeholder, "placeholder");
  }
  let options = [];
  if (OPTION_TYPES.has(body.dataType)) {
    if (!Array.isArray(body.options) || body.options.length === 0 || body.options.length > 20) {
      throw new ExtensionsError(400, "validation_error", "options are required for this dataType", {
        field: "options",
      });
    }
    options = body.options.map((option) => cleanName(option, "options"));
  }
  try {
    const doc = await CustomField.create({
      siteId,
      userId: req.publicApi.user._id,
      appId: req.publicApi.appId || null,
      installationId: req.publicApi.installationId || null,
      key,
      name,
      dataType: body.dataType,
      placeholder,
      options,
    });
    return presentField(doc);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ExtensionsError(409, "conflict", "A custom field with this key already exists", { field: "key" });
    }
    throw err;
  }
}

async function deleteCustomField(req, siteId, fieldId) {
  await assertOwnedSite(req, siteId);
  if (!mongoose.isValidObjectId(fieldId)) {
    throw new ExtensionsError(404, "not_found", "Custom field not found");
  }
  const doc = await CustomField.findOneAndDelete({ _id: fieldId, siteId, ...callerFilter(req) });
  if (!doc) throw new ExtensionsError(404, "not_found", "Custom field not found");
  return { id: doc._id.toString(), deleted: true };
}

async function listWorkflowActions(req, siteId) {
  await assertOwnedSite(req, siteId);
  const docs = await WorkflowAction.find({ siteId, ...callerFilter(req) }).sort({ key: 1 }).limit(100).lean();
  return docs.map(presentAction);
}

async function createWorkflowAction(req, siteId, body) {
  await assertOwnedSite(req, siteId);
  const key = cleanKey(body?.key, "key");
  const name = cleanName(body?.name, "name");
  let targetUrl;
  try {
    targetUrl = assertPublicHttpsUrl(body?.targetUrl);
  } catch (_err) {
    throw new ExtensionsError(400, "validation_error", "targetUrl must be a public https URL", {
      field: "targetUrl",
    });
  }
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
  let sealed;
  try {
    sealed = encryptSecret(secret);
  } catch (err) {
    if (err.code === "credential_storage_unconfigured") {
      throw new ExtensionsError(
        503,
        "credential_storage_unconfigured",
        "Webhook signing secrets cannot be stored until credential encryption is configured"
      );
    }
    throw err;
  }
  try {
    const doc = await WorkflowAction.create({
      siteId,
      userId: req.publicApi.user._id,
      appId: req.publicApi.appId || null,
      installationId: req.publicApi.installationId || null,
      key,
      name,
      description: cleanDescription(body?.description),
      targetUrl,
      keyVersion: sealed.keyVersion,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      authTag: sealed.authTag,
      secretLast4: secret.slice(-4),
    });
    return { action: presentAction(doc), signingSecret: secret };
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ExtensionsError(409, "conflict", "A workflow action with this key already exists", {
        field: "key",
      });
    }
    throw err;
  }
}

async function executeWorkflowAction(req, siteId, key, body) {
  await assertOwnedSite(req, siteId);
  const actionKey = cleanKey(key, "key");
  const doc = await WorkflowAction.findOne({ siteId, key: actionKey, ...callerFilter(req) });
  if (!doc) throw new ExtensionsError(404, "not_found", "Workflow action not found");
  const payload = cleanPayload(body?.payload, "payload");
  const event = {
    id: newEventId(),
    type: "workflow.action.executed",
    createdAt: new Date().toISOString(),
    data: {
      siteId: String(siteId),
      actionId: doc._id.toString(),
      actionKey: doc.key,
      payload,
    },
  };
  const rawBody = JSON.stringify(event);
  const secret = decryptSecret({
    keyVersion: doc.keyVersion,
    ciphertext: doc.ciphertext,
    iv: doc.iv,
    authTag: doc.authTag,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  let response;
  try {
    response = await fetch(doc.targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FindVirtualMe-Timestamp": timestamp,
        "X-FindVirtualMe-Signature": signatureHeader(secret, timestamp, rawBody),
        "X-FindVirtualMe-Event": event.id,
      },
      body: rawBody,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch (_err) {
    throw new ExtensionsError(502, "action_delivery_failed", "Workflow action did not accept the request");
  }
  const text = await response.text();
  return {
    id: event.id,
    statusCode: response.status,
    body: text.slice(0, 4000),
  };
}

async function listWorkflowTriggers(req, siteId) {
  await assertOwnedSite(req, siteId);
  const docs = await WorkflowTrigger.find({ siteId, ...callerFilter(req) }).sort({ key: 1 }).limit(100).lean();
  return docs.map(presentTrigger);
}

async function createWorkflowTrigger(req, siteId, body) {
  await assertOwnedSite(req, siteId);
  const key = cleanKey(body?.key, "key");
  const name = cleanName(body?.name, "name");
  try {
    const doc = await WorkflowTrigger.create({
      siteId,
      userId: req.publicApi.user._id,
      appId: req.publicApi.appId || null,
      installationId: req.publicApi.installationId || null,
      key,
      name,
      description: cleanDescription(body?.description),
      samplePayload: cleanPayload(body?.samplePayload, "samplePayload"),
    });
    return presentTrigger(doc);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ExtensionsError(409, "conflict", "A workflow trigger with this key already exists", {
        field: "key",
      });
    }
    throw err;
  }
}

async function fireWorkflowTrigger(req, siteId, key, body) {
  await assertOwnedSite(req, siteId);
  const triggerKey = cleanKey(key, "key");
  const doc = await WorkflowTrigger.findOne({ siteId, key: triggerKey, ...callerFilter(req) }).lean();
  if (!doc) throw new ExtensionsError(404, "not_found", "Workflow trigger not found");
  const payload = cleanPayload(body?.payload, "payload");
  notifyWorkflowTriggerFired({
    ownerId: req.publicApi.user._id,
    siteId,
    triggerId: doc._id,
    triggerKey: doc.key,
    payload,
  });
  return { id: doc._id.toString(), key: doc.key, accepted: true };
}

module.exports = {
  ExtensionsError,
  DATA_TYPES,
  listCustomFields,
  createCustomField,
  deleteCustomField,
  listWorkflowActions,
  createWorkflowAction,
  executeWorkflowAction,
  listWorkflowTriggers,
  createWorkflowTrigger,
  fireWorkflowTrigger,
};
