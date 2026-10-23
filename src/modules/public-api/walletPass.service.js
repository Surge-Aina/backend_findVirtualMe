const crypto = require("crypto");
const QRCode = require("qrcode");
const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const User = require("../../shared/models/User");
const DomainRoute = require("../domains/DomainRouter/DomainRouter.model");
const WalletPassSettings = require("./walletPassSettings.model");
const WalletPassLink = require("./walletPassLink.model");
const { encryptSecret, decryptSecret } = require("./secretBox");
const { platformHost } = require("./siteView");
const { consumeRateLimit } = require("./rateLimit");
const { createVisitorPass, addUrlForSerial } = require("./walletAdd.adapter");
const { claimForm, fallbackPage, messagePage } = require("./walletPass.page");

const DNS_LABEL = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/;
const PASS_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const GROUP_RE = /^[A-Za-z0-9_-]{1,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_NAME = "fvm_wallet";
const POST_MAX = 10;
const POST_WINDOW_MS = 60 * 1000;

const UNAVAILABLE = "This page is not available.";
const NOT_READY = "This pass is not available yet.";
const TRY_AGAIN = "This pass could not be opened. Try again.";
const NEED_EMAIL = "Enter an email address.";
const NEED_CONSENT = "Consent is required before a pass can be created.";
const RATE_LIMITED = "Too many attempts. Wait a minute and try again.";

function normalizePass(raw) {
  if (raw === undefined || raw === null || raw === "") return "card";
  const value = String(raw).trim().toLowerCase();
  if (!PASS_RE.test(value)) return null;
  return value;
}

function landingUrl(site, pass) {
  const slug = typeof site.slug === "string" ? site.slug.trim().toLowerCase() : "";
  if (!DNS_LABEL.test(slug)) return "";
  const base = `https://${slug}.${platformHost()}/wallet`;
  if (!pass || pass === "card") return base;
  return `${base}?pass=${encodeURIComponent(pass)}`;
}

function requestHost(req) {
  const raw = req.get("host") || "";
  return raw.split(":")[0].trim().toLowerCase().replace(/\.+$/, "");
}

function isPlatformHost(host) {
  const platform = platformHost();
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === platform ||
    host === `www.${platform}`
  );
}

function hashEmail(siteId, email) {
  const pepper = process.env.PUBLIC_API_KEY_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}:${siteId}:${email}`).digest("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function deviceFromUserAgent(userAgent) {
  const text = String(userAgent || "");
  if (/iPad|iPhone|iPod/i.test(text)) return "ios";
  if (/Android/i.test(text)) return "android";
  return "desktop";
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== COOKIE_NAME) continue;
    const value = decodeURIComponent(trimmed.slice(eq + 1));
    if (/^[A-Za-z0-9_-]{20,200}$/.test(value)) return value;
  }
  return "";
}

function cookieHeader(token, secure) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/wallet",
    "Max-Age=31536000",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function html(status, body, extra) {
  return { kind: "html", status, html: body, ...extra };
}

function redirect(location, cookie) {
  return { kind: "redirect", status: 302, location, cookie };
}

async function resolvePublishedSite(req, bodySite) {
  const host = requestHost(req);
  const platform = platformHost();
  const suffix = `.${platform}`;
  if (host.endsWith(suffix) && host.length > suffix.length) {
    const slug = host.slice(0, -suffix.length);
    if (!slug.includes(".") && DNS_LABEL.test(slug)) {
      const site = await Portfolio.findOne({ slug, visibility: "public" });
      if (site) return site;
    }
  }

  if (host && !isPlatformHost(host)) {
    const names = host.startsWith("www.") ? [host, host.slice(4)] : [host];
    const user = await User.findOne({
      "domains.domain": { $in: names },
      "domains.status": "active",
    });
    if (user) {
      const domain = (user.domains || []).find(
        (item) => names.includes(item.domain) && item.status === "active" && item.portfolioId
      );
      if (domain && mongoose.isValidObjectId(domain.portfolioId)) {
        const site = await Portfolio.findOne({ _id: domain.portfolioId, visibility: "public" });
        if (site) return site;
      }
    }
    const route = await DomainRoute.findOne({ domain: { $in: names }, isActive: true });
    if (route?.portfolioId) {
      const site = await Portfolio.findOne({ _id: route.portfolioId, visibility: "public" });
      if (site) return site;
    }
  }

  if (!isPlatformHost(host)) return null;
  const raw = bodySite !== undefined ? bodySite : req.query.site;
  const slug = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!DNS_LABEL.test(slug)) return null;
  return Portfolio.findOne({ slug, visibility: "public" });
}

async function ownedSite(user, id) {
  if (!user || !mongoose.isValidObjectId(id)) return null;
  return Portfolio.findOne({ _id: id, owner: user._id || user.id });
}

async function settingsFor(siteId) {
  return WalletPassSettings.findOne({ siteId });
}

function configured(settings) {
  return Boolean(settings && settings.groupId && settings.keyCiphertext);
}

function readApiKey(settings) {
  if (!configured(settings)) return "";
  try {
    return decryptSecret({
      keyVersion: settings.keyVersion,
      ciphertext: settings.keyCiphertext,
      iv: settings.keyIv,
      authTag: settings.keyAuthTag,
    });
  } catch (_err) {
    console.error("wallet_pass_key_unreadable");
    return "";
  }
}

async function ownerPayload(site, pass) {
  const settings = await settingsFor(site._id);
  const url = landingUrl(site, pass);
  return {
    url,
    pass,
    configured: configured(settings),
    groupId: settings?.groupId || null,
    secretLast4: settings?.secretLast4 || null,
  };
}

async function saveSettings(site, { groupId, apiKey }) {
  const existing = await settingsFor(site._id);
  const nextGroup = typeof groupId === "string" ? groupId.trim() : "";
  if (!GROUP_RE.test(nextGroup)) {
    const err = new Error("groupId is invalid");
    err.code = "validation_error";
    err.status = 400;
    throw err;
  }
  let sealed = null;
  let last4 = existing?.secretLast4 || "";
  const provided = typeof apiKey === "string" ? apiKey.trim() : "";
  if (provided) {
    if (provided.length < 8 || provided.length > 500 || /\s/.test(provided)) {
      const err = new Error("apiKey is invalid");
      err.code = "validation_error";
      err.status = 400;
      throw err;
    }
    sealed = encryptSecret(provided);
    last4 = provided.slice(-4);
  } else if (!existing) {
    const err = new Error("apiKey is required");
    err.code = "validation_error";
    err.status = 400;
    throw err;
  }
  const update = {
    ownerId: site.owner,
    groupId: nextGroup,
    ...(sealed
      ? {
          keyVersion: sealed.keyVersion,
          keyCiphertext: sealed.ciphertext,
          keyIv: sealed.iv,
          keyAuthTag: sealed.authTag,
          secretLast4: last4,
        }
      : {}),
  };
  await WalletPassSettings.findOneAndUpdate(
    { siteId: site._id },
    { $set: update, $setOnInsert: { siteId: site._id } },
    { upsert: true, new: true }
  );
}

async function qrPng(url) {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

async function rememberedLink(siteId, req) {
  const token = readCookie(req);
  if (!token) return null;
  return WalletPassLink.findOne({ siteId, cookieHash: hashToken(token) });
}

async function issueCookie(link, secure) {
  const token = crypto.randomBytes(32).toString("base64url");
  link.cookieHash = hashToken(token);
  await link.save();
  return cookieHeader(token, secure);
}

async function presentLink(link, req) {
  const addUrl = addUrlForSerial(link.serialNumber);
  if (!addUrl) return html(503, messagePage("Add to wallet", NOT_READY));
  const secure = Boolean(req.secure);
  const cookie = await issueCookie(link, secure);
  const device = deviceFromUserAgent(req.get("user-agent"));
  if (device === "ios" || device === "android") return redirect(addUrl, cookie);
  const qrDataUrl = await QRCode.toDataURL(addUrl, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return html(200, fallbackPage({ addUrl, qrDataUrl }), { cookie });
}

async function openOrCreate({ site, settings, email }) {
  const emailHash = hashEmail(site._id.toString(), email);
  const existing = await WalletPassLink.findOne({ siteId: site._id, emailHash });
  if (existing) return existing;

  const apiKey = readApiKey(settings);
  if (!apiKey) return null;
  const created = await createVisitorPass({
    apiKey,
    groupId: settings.groupId,
    email,
    idempotencyKey: emailHash,
  });
  if (!created.ok) return { error: created.reason };

  try {
    return await WalletPassLink.create({
      siteId: site._id,
      emailHash,
      serialNumber: created.serialNumber,
      cookieHash: hashToken(crypto.randomBytes(32).toString("base64url")),
    });
  } catch (err) {
    if (!err || err.code !== 11000) throw err;
    const winner = await WalletPassLink.findOne({ siteId: site._id, emailHash });
    if (winner) return winner;
    throw err;
  }
}

async function handlePublicVisit(req) {
  const pass = normalizePass(req.query.pass !== undefined ? req.query.pass : req.body?.pass);
  if (!pass) return html(400, messagePage("Add to wallet", "This pass type is not available."));

  const bodySite = req.method === "POST" ? req.body?.site : undefined;
  const site = await resolvePublishedSite(req, bodySite);
  if (!site) return html(404, messagePage("Add to wallet", UNAVAILABLE));

  const settings = await settingsFor(site._id);
  if (!configured(settings)) return html(200, messagePage("Add to wallet", NOT_READY));

  if (req.method === "GET") {
    const remembered = await rememberedLink(site._id, req);
    if (remembered) return presentLink(remembered, req);
    return html(200, claimForm({ siteSlug: site.slug || "", pass, error: "" }));
  }

  const ip = req.ip || "";
  const ipHash = crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 32);
  const limit = await consumeRateLimit({
    bucketKey: `wallet-pass:${site._id}:${ipHash}`,
    max: POST_MAX,
    windowMs: POST_WINDOW_MS,
  });
  if (!limit.allowed) {
    return html(429, claimForm({ siteSlug: site.slug || "", pass, error: RATE_LIMITED }));
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return html(400, claimForm({ siteSlug: site.slug || "", pass, error: NEED_EMAIL }));
  }
  if (req.body?.consent !== "yes") {
    return html(400, claimForm({ siteSlug: site.slug || "", pass, error: NEED_CONSENT }));
  }

  const link = await openOrCreate({ site, settings, email });
  if (!link) return html(200, messagePage("Add to wallet", NOT_READY));
  if (link.error) return html(502, claimForm({ siteSlug: site.slug || "", pass, error: TRY_AGAIN }));
  return presentLink(link, req);
}

module.exports = {
  normalizePass,
  landingUrl,
  deviceFromUserAgent,
  ownedSite,
  ownerPayload,
  saveSettings,
  qrPng,
  handlePublicVisit,
};
