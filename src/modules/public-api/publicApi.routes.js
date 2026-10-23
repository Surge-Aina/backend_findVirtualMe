const express = require("express");
const openapi = require("./openapi.json");
const { authenticateApiKey, requireScope, requireAnyScope } = require("./publicApi.auth");
const { publicApiRateLimit } = require("./rateLimit");
const { apiVersion } = require("./apiVersion");
const controller = require("./publicApi.controller");
const webhooks = require("./webhooks.controller");
const extensions = require("../marketplace/siteExtensions.controller");
const { sendError } = require("./errors");

const router = express.Router();

router.get("/openapi.json", apiVersion, (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(openapi);
});

router.use(authenticateApiKey);
router.use(apiVersion);
router.use(publicApiRateLimit);

router.get("/me", controller.me);
router.get("/sites", requireScope("sites:read"), controller.listSites);
router.get("/sites/:id", requireScope("sites:read"), controller.getSite);
router.patch("/sites/:id/content", requireScope("sites:write"), controller.updateContent);
router.get("/business-profile", requireScope("profile:read"), controller.businessProfile);
router.get("/leads", requireScope("leads:read"), controller.listLeads);
router.get(
  "/sites/:id/custom-fields",
  requireAnyScope("custom_fields:read", "custom_fields:write"),
  extensions.listFields
);
router.post("/sites/:id/custom-fields", requireScope("custom_fields:write"), extensions.createField);
router.delete(
  "/sites/:id/custom-fields/:fieldId",
  requireScope("custom_fields:write"),
  extensions.deleteField
);
router.get(
  "/sites/:id/workflow-actions",
  requireAnyScope("workflows:read", "workflows:write"),
  extensions.listActions
);
router.post("/sites/:id/workflow-actions", requireScope("workflows:write"), extensions.createAction);
router.post(
  "/sites/:id/workflow-actions/:key/execute",
  requireScope("workflows:write"),
  extensions.executeAction
);
router.get(
  "/sites/:id/workflow-triggers",
  requireAnyScope("workflows:read", "workflows:write"),
  extensions.listTriggers
);
router.post("/sites/:id/workflow-triggers", requireScope("workflows:write"), extensions.createTrigger);
router.post(
  "/sites/:id/workflow-triggers/:key/fire",
  requireScope("workflows:write"),
  extensions.fireTrigger
);
router.delete("/installation", controller.uninstall);
router.post("/webhooks", requireScope("webhooks:write"), webhooks.create);
router.get("/webhooks", requireScope("webhooks:write"), webhooks.list);
router.delete("/webhooks/:id", requireScope("webhooks:write"), webhooks.remove);

router.use((_req, res) => {
  sendError(res, 404, "not_found", "Unknown public API route");
});

module.exports = router;
