const express = require("express");
const auth = require("../../shared/middleware/auth");
const { sendError } = require("./errors");
const {
  normalizePass,
  landingUrl,
  ownedSite,
  ownerPayload,
  saveSettings,
  qrPng,
  handlePublicVisit,
} = require("./walletPass.service");
const { messagePage } = require("./walletPass.page");

const publicRouter = express.Router();
const ownerRouter = express.Router();

function sendHtml(res, status, body) {
  res.status(status);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
  res.set("Vary", "User-Agent");
  return res.send(body);
}

async function visit(req, res) {
  try {
    const result = await handlePublicVisit(req);
    if (result.cookie) res.set("Set-Cookie", result.cookie);
    if (result.kind === "redirect") return res.redirect(result.status, result.location);
    return sendHtml(res, result.status, result.html);
  } catch (_err) {
    console.error("wallet_pass_request_failed");
    return sendHtml(res, 500, messagePage("Add to wallet", "This pass could not be opened. Try again."));
  }
}

publicRouter.get("/wallet", visit);
publicRouter.post("/wallet", visit);

ownerRouter.get("/:id/wallet-pass/qr.png", auth, async (req, res) => {
  try {
    const pass = normalizePass(req.query.pass);
    if (!pass) return sendError(res, 400, "validation_error", "pass is invalid");
    const site = await ownedSite(req.user, req.params.id);
    if (!site) return sendError(res, 404, "not_found", "Site not found");
    const url = landingUrl(site, pass);
    if (!url) return sendError(res, 409, "site_hostname_unavailable", "This site has no public hostname");
    const png = await qrPng(url);
    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", 'attachment; filename="wallet-qr.png"');
    res.set("Cache-Control", "private, no-store");
    return res.send(png);
  } catch (_err) {
    console.error("wallet_pass_qr_failed");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
});

ownerRouter.get("/:id/wallet-pass", auth, async (req, res) => {
  try {
    const pass = normalizePass(req.query.pass);
    if (!pass) return sendError(res, 400, "validation_error", "pass is invalid");
    const site = await ownedSite(req.user, req.params.id);
    if (!site) return sendError(res, 404, "not_found", "Site not found");
    const data = await ownerPayload(site, pass);
    if (!data.url) return sendError(res, 409, "site_hostname_unavailable", "This site has no public hostname");
    return res.json({ data });
  } catch (_err) {
    console.error("wallet_pass_settings_failed");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
});

ownerRouter.put("/:id/wallet-pass", auth, async (req, res) => {
  try {
    const pass = normalizePass(req.query.pass);
    if (!pass) return sendError(res, 400, "validation_error", "pass is invalid");
    const site = await ownedSite(req.user, req.params.id);
    if (!site) return sendError(res, 404, "not_found", "Site not found");
    await saveSettings(site, { groupId: req.body?.groupId, apiKey: req.body?.apiKey });
    const data = await ownerPayload(site, pass);
    return res.json({ data });
  } catch (err) {
    if (err && err.code === "credential_storage_unconfigured") {
      return sendError(res, 503, "credential_storage_unconfigured", "Credential storage is not configured");
    }
    if (err && err.status === 400) return sendError(res, 400, "validation_error", "Invalid wallet pass settings");
    console.error("wallet_pass_settings_failed");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
});

module.exports = { publicRouter, ownerRouter };
