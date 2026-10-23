const express = require("express");
const openapi = require("./openapi.json");
const { authenticateApiKey, requireScope } = require("./publicApi.auth");
const { publicApiRateLimit } = require("./rateLimit");
const controller = require("./publicApi.controller");
const webhooks = require("./webhooks.controller");
const { sendError } = require("./errors");

const router = express.Router();

router.get("/openapi.json", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(openapi);
});

router.use(authenticateApiKey);
router.use(publicApiRateLimit);

router.get("/me", controller.me);
router.get("/sites", requireScope("sites:read"), controller.listSites);
router.get("/sites/:id", requireScope("sites:read"), controller.getSite);
router.patch("/sites/:id/content", requireScope("sites:write"), controller.updateContent);
router.get("/business-profile", requireScope("profile:read"), controller.businessProfile);
router.get("/leads", requireScope("leads:read"), controller.listLeads);
router.delete("/installation", controller.uninstall);
router.post("/webhooks", requireScope("webhooks:write"), webhooks.create);
router.get("/webhooks", requireScope("webhooks:write"), webhooks.list);
router.delete("/webhooks/:id", requireScope("webhooks:write"), webhooks.remove);

router.use((_req, res) => {
  sendError(res, 404, "not_found", "Unknown public API route");
});

module.exports = router;
