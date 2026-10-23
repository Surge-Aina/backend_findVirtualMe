const crypto = require("crypto");
const mongoose = require("mongoose");
const PlatformApp = require("./app.model");
const Installation = require("./installation.model");
const OAuthCode = require("./oauthCode.model");
const OAuthToken = require("./oauthToken.model");
const Portfolio = require("../portfolios/models/Portfolio");
const User = require("../../shared/models/User");
const { hashKey } = require("../public-api/apiKey.service");
const { isPublicApiScope, PUBLIC_API_SCOPES } = require("../public-api/scopes");
const { notifyAppInstalled, notifyAppUninstalled } = require("../public-api/lifecycleEvents");
const { assertPublicHttpsUrl } = require("../public-api/webhookUrls");
const { encryptSecret } = require("../public-api/secretBox");
const { createEndpoint, WEBHOOK_EVENTS } = require("../public-api/webhook.service");
const { WebhookEndpoint } = require("../public-api/webhookEndpoint.model");

class MarketplaceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "MarketplaceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;

function slugify(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!slug) throw new MarketplaceError(400, "validation_error", "name is required", { field: "name" });
  return slug;
}

function cleanName(name) {
  if (typeof name !== "string") {
    throw new MarketplaceError(400, "validation_error", "name must be a string", { field: "name" });
  }
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new MarketplaceError(400, "validation_error", "name is invalid", { field: "name" });
  }
  return trimmed;
}

function cleanDescription(description) {
  if (description === undefined || description === null || description === "") return "";
  if (typeof description !== "string") {
    throw new MarketplaceError(400, "validation_error", "description must be a string", {
      field: "description",
    });
  }
  const trimmed = description.trim();
  if (trimmed.length > 500) {
    throw new MarketplaceError(400, "validation_error", "description is too long", {
      field: "description",
    });
  }
  return trimmed;
}

function normalizeScopes(scopes) {
  const list = Array.isArray(scopes)
    ? scopes
    : typeof scopes === "string"
      ? scopes.split(/[,\s]+/).filter(Boolean)
      : null;
  if (!list || list.length === 0) {
    throw new MarketplaceError(400, "validation_error", "scopes are required", { field: "scopes" });
  }
  const normalized = [];
  for (const scope of list) {
    if (!isPublicApiScope(scope)) {
      throw new MarketplaceError(400, "validation_error", "scopes include an unknown value", {
        field: "scopes",
      });
    }
    if (!normalized.includes(scope)) normalized.push(scope);
  }
  return normalized;
}

function normalizeRedirectUris(uris) {
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5) {
    throw new MarketplaceError(400, "validation_error", "redirectUris must list 1 to 5 https URLs", {
      field: "redirectUris",
    });
  }
  const normalized = [];
  for (const uri of uris) {
    let value;
    try {
      value = assertPublicHttpsUrl(uri);
    } catch (_err) {
      throw new MarketplaceError(400, "validation_error", "redirectUris must be public https URLs", {
        field: "redirectUris",
      });
    }
    if (!normalized.includes(value)) normalized.push(value);
  }
  return normalized;
}

function presentApp(doc, { includeReview = false } = {}) {
  const view = {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description || "",
    clientId: doc.clientId,
    redirectUris: [...doc.redirectUris],
    scopes: [...doc.scopes],
    reviewStatus: doc.reviewStatus,
    webhookUrl: doc.webhookUrl || "",
  };
  if (includeReview) {
    view.secretLast4 = doc.secretLast4;
    view.webhookSecretLast4 = doc.webhookSecretLast4 || "";
  }
  return view;
}

function sealWebhook(url) {
  if (url === undefined || url === null || url === "") return null;
  let normalized;
  try {
    normalized = assertPublicHttpsUrl(url);
  } catch (_err) {
    throw new MarketplaceError(400, "validation_error", "webhookUrl must be a public https URL", {
      field: "webhookUrl",
    });
  }
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
  let sealed;
  try {
    sealed = encryptSecret(secret);
  } catch (err) {
    if (err.code === "credential_storage_unconfigured") {
      throw new MarketplaceError(
        503,
        "credential_storage_unconfigured",
        "Webhook signing secrets cannot be stored until credential encryption is configured"
      );
    }
    throw err;
  }
  return { url: normalized, secret, sealed };
}

async function registerApp({ ownerId, name, description, redirectUris, scopes, webhookUrl }) {
  if (!mongoose.isValidObjectId(ownerId)) {
    throw new MarketplaceError(401, "unauthorized", "Authentication required");
  }
  const clean = cleanName(name);
  const slugBase = slugify(clean);
  let slug = slugBase;
  for (let i = 0; i < 5; i += 1) {
    const taken = await PlatformApp.findOne({ slug }).select("_id").lean();
    if (!taken) break;
    slug = `${slugBase}-${crypto.randomBytes(2).toString("hex")}`;
  }
  const clientSecret = `fvm_sec_${crypto.randomBytes(32).toString("base64url")}`;
  const clientId = `fvm_app_${crypto.randomBytes(12).toString("base64url")}`;
  const webhook = sealWebhook(webhookUrl);
  const doc = await PlatformApp.create({
    ownerId,
    name: clean,
    slug,
    description: cleanDescription(description),
    clientId,
    clientSecretHash: hashKey(clientSecret),
    secretLast4: clientSecret.slice(-4),
    redirectUris: normalizeRedirectUris(redirectUris),
    scopes: normalizeScopes(scopes),
    webhookUrl: webhook ? webhook.url : "",
    webhookKeyVersion: webhook ? webhook.sealed.keyVersion : "",
    webhookCiphertext: webhook ? webhook.sealed.ciphertext : "",
    webhookIv: webhook ? webhook.sealed.iv : "",
    webhookAuthTag: webhook ? webhook.sealed.authTag : "",
    webhookSecretLast4: webhook ? webhook.secret.slice(-4) : "",
    reviewStatus: "pending",
  });
  return {
    app: presentApp(doc, { includeReview: true }),
    clientSecret,
    webhookSecret: webhook ? webhook.secret : null,
  };
}

async function subscribeAppWebhook({ app, installation }) {
  if (!app.webhookUrl || !app.webhookCiphertext) return;
  const existing = await WebhookEndpoint.findOne({
    installationId: installation._id,
    url: app.webhookUrl,
  })
    .select("_id")
    .lean();
  if (existing) return;
  await createEndpoint({
    userId: installation.userId,
    url: app.webhookUrl,
    events: [...WEBHOOK_EVENTS],
    appId: app._id,
    installationId: installation._id,
    sealed: {
      keyVersion: app.webhookKeyVersion,
      ciphertext: app.webhookCiphertext,
      iv: app.webhookIv,
      authTag: app.webhookAuthTag,
    },
    secretLast4: app.webhookSecretLast4,
  });
}

async function listOwnApps(ownerId) {
  const docs = await PlatformApp.find({ ownerId }).sort({ createdAt: -1 }).limit(50).lean();
  return docs.map((doc) => presentApp(doc, { includeReview: true }));
}

async function listApprovedApps() {
  const docs = await PlatformApp.find({ reviewStatus: "approved" }).sort({ name: 1 }).limit(100).lean();
  return docs.map((doc) => presentApp(doc));
}

async function reviewApp({ appId, reviewStatus }) {
  if (!["approved", "rejected"].includes(reviewStatus)) {
    throw new MarketplaceError(400, "validation_error", "reviewStatus must be approved or rejected", {
      field: "reviewStatus",
    });
  }
  if (!mongoose.isValidObjectId(appId)) {
    throw new MarketplaceError(404, "not_found", "App not found");
  }
  const doc = await PlatformApp.findByIdAndUpdate(appId, { $set: { reviewStatus } }, { new: true });
  if (!doc) throw new MarketplaceError(404, "not_found", "App not found");
  return presentApp(doc, { includeReview: true });
}

function presentInstallation(doc, app) {
  return {
    id: doc._id.toString(),
    appId: doc.appId.toString(),
    appName: app ? app.name : null,
    slug: app ? app.slug : null,
    siteId: doc.siteId.toString(),
    scopes: [...doc.scopes],
    status: doc.status,
    installedAt: doc.installedAt,
  };
}

async function listInstallations(userId) {
  const docs = await Installation.find({ userId, status: "installed" }).sort({ installedAt: -1 }).lean();
  const apps = await PlatformApp.find({ _id: { $in: docs.map((doc) => doc.appId) } })
    .select("name slug")
    .lean();
  const byId = new Map(apps.map((app) => [String(app._id), app]));
  return docs.map((doc) => presentInstallation(doc, byId.get(String(doc.appId))));
}

async function listConsentSites(userId) {
  const docs = await Portfolio.find({ owner: userId }).select("title slug").sort({ title: 1 }).limit(50).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
  }));
}

async function authorizeInstall({
  userId,
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  codeChallengeMethod,
  siteId,
}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new MarketplaceError(401, "unauthorized", "Authentication required");
  }
  if (codeChallengeMethod !== "S256") {
    throw new MarketplaceError(400, "validation_error", "code_challenge_method must be S256", {
      field: "code_challenge_method",
    });
  }
  if (typeof codeChallenge !== "string" || !/^[A-Za-z0-9\-_]{43,128}$/.test(codeChallenge)) {
    throw new MarketplaceError(400, "validation_error", "code_challenge is invalid", {
      field: "code_challenge",
    });
  }
  if (state !== undefined && state !== null && (typeof state !== "string" || state.length > 512)) {
    throw new MarketplaceError(400, "validation_error", "state is invalid", { field: "state" });
  }
  const app = await PlatformApp.findOne({ clientId });
  if (!app || app.reviewStatus !== "approved") {
    throw new MarketplaceError(400, "validation_error", "app is not available to install", {
      field: "client_id",
    });
  }
  let normalizedRedirect;
  try {
    normalizedRedirect = assertPublicHttpsUrl(redirectUri);
  } catch (_err) {
    throw new MarketplaceError(400, "validation_error", "redirect_uri is invalid", {
      field: "redirect_uri",
    });
  }
  if (!app.redirectUris.includes(normalizedRedirect)) {
    throw new MarketplaceError(400, "validation_error", "redirect_uri is not registered", {
      field: "redirect_uri",
    });
  }
  const requested = normalizeScopes(scope);
  for (const item of requested) {
    if (!app.scopes.includes(item)) {
      throw new MarketplaceError(400, "validation_error", "scope is not allowed for this app", {
        field: "scope",
      });
    }
  }
  if (!mongoose.isValidObjectId(siteId)) {
    throw new MarketplaceError(404, "not_found", "Site not found");
  }
  const site = await Portfolio.findOne({ _id: siteId, owner: userId }).select("_id").lean();
  if (!site) throw new MarketplaceError(404, "not_found", "Site not found");

  const code = `fvm_code_${crypto.randomBytes(24).toString("base64url")}`;
  await OAuthCode.create({
    codeHash: hashKey(code),
    appId: app._id,
    userId,
    siteId,
    scopes: requested,
    redirectUri: normalizedRedirect,
    codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  const redirect = new URL(normalizedRedirect);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return { redirectUrl: redirect.toString(), code, scopes: requested };
}

function pkceMatches(verifier, challenge) {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  const digest = crypto.createHash("sha256").update(verifier).digest("base64url");
  return digest === challenge;
}

async function issueTokenPair({ installation, appId, userId, siteId, scopes }) {
  await OAuthToken.updateMany(
    { installationId: installation._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  const accessToken = `fvm_at_${crypto.randomBytes(32).toString("base64url")}`;
  const refreshToken = `fvm_rt_${crypto.randomBytes(32).toString("base64url")}`;
  const now = Date.now();
  await OAuthToken.create({
    installationId: installation._id,
    appId,
    userId,
    siteId,
    scopes,
    accessTokenHash: hashKey(accessToken),
    refreshTokenHash: hashKey(refreshToken),
    accessExpiresAt: new Date(now + ACCESS_TTL_MS),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_expires_in: Math.floor(REFRESH_TTL_MS / 1000),
    scope: scopes.join(" "),
    site_id: String(siteId),
  };
}

async function exchangeAuthorizationCode({ code, redirectUri, clientId, clientSecret, codeVerifier }) {
  const app = await PlatformApp.findOne({ clientId });
  if (!app || hashKey(clientSecret || "") !== app.clientSecretHash) {
    throw new MarketplaceError(401, "invalid_client", "Client authentication failed");
  }
  const record = await OAuthCode.findOne({ codeHash: hashKey(code || "") });
  if (!record || record.usedAt || record.expiresAt < new Date() || String(record.appId) !== String(app._id)) {
    throw new MarketplaceError(400, "invalid_grant", "Authorization code is invalid");
  }
  let normalizedRedirect;
  try {
    normalizedRedirect = assertPublicHttpsUrl(redirectUri);
  } catch (_err) {
    throw new MarketplaceError(400, "invalid_grant", "redirect_uri does not match");
  }
  if (normalizedRedirect !== record.redirectUri || !pkceMatches(codeVerifier, record.codeChallenge)) {
    throw new MarketplaceError(400, "invalid_grant", "Authorization code is invalid");
  }
  record.usedAt = new Date();
  await record.save();

  let installation = await Installation.findOne({
    appId: app._id,
    siteId: record.siteId,
    status: "installed",
  });
  const created = !installation;
  if (!installation) {
    installation = await Installation.create({
      appId: app._id,
      userId: record.userId,
      siteId: record.siteId,
      scopes: record.scopes,
      status: "installed",
    });
  } else {
    installation.scopes = record.scopes;
    installation.userId = record.userId;
    await installation.save();
  }
  await subscribeAppWebhook({ app, installation });
  if (created) {
    notifyAppInstalled({
      ownerId: record.userId,
      siteId: record.siteId,
      appId: app._id,
      installationId: installation._id,
      scopes: record.scopes,
    });
  }
  return issueTokenPair({
    installation,
    appId: app._id,
    userId: record.userId,
    siteId: record.siteId,
    scopes: record.scopes,
  });
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const app = await PlatformApp.findOne({ clientId });
  if (!app || hashKey(clientSecret || "") !== app.clientSecretHash) {
    throw new MarketplaceError(401, "invalid_client", "Client authentication failed");
  }
  const record = await OAuthToken.findOne({
    refreshTokenHash: hashKey(refreshToken || ""),
    revokedAt: null,
  });
  if (!record || record.refreshExpiresAt < new Date() || String(record.appId) !== String(app._id)) {
    throw new MarketplaceError(400, "invalid_grant", "Refresh token is invalid");
  }
  const installation = await Installation.findById(record.installationId);
  if (!installation || installation.status !== "installed") {
    throw new MarketplaceError(400, "invalid_grant", "Installation is not active");
  }
  return issueTokenPair({
    installation,
    appId: app._id,
    userId: record.userId,
    siteId: record.siteId,
    scopes: record.scopes,
  });
}

async function uninstallInstallation({ userId, installationId }) {
  if (!mongoose.isValidObjectId(installationId)) {
    throw new MarketplaceError(404, "not_found", "Installation not found");
  }
  const installation = await Installation.findOne({ _id: installationId, userId, status: "installed" });
  if (!installation) throw new MarketplaceError(404, "not_found", "Installation not found");
  installation.status = "uninstalled";
  installation.uninstalledAt = new Date();
  await installation.save();
  await OAuthToken.updateMany(
    { installationId: installation._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  notifyAppUninstalled({
    ownerId: userId,
    siteId: installation.siteId,
    appId: installation.appId,
    installationId: installation._id,
    scopes: installation.scopes,
  });
  return { id: installation._id.toString(), status: "uninstalled" };
}

async function authenticateAccessToken(secret) {
  if (typeof secret !== "string" || !secret.startsWith("fvm_at_")) return null;
  const record = await OAuthToken.findOne({ accessTokenHash: hashKey(secret), revokedAt: null });
  if (!record || record.accessExpiresAt < new Date()) return null;
  const installation = await Installation.findById(record.installationId).lean();
  if (!installation || installation.status !== "installed") return null;
  const user = await User.findById(record.userId).select("_id username role createdAt isActive");
  if (!user) return null;
  return { user, installation, scopes: record.scopes };
}

module.exports = {
  MarketplaceError,
  PUBLIC_API_SCOPES,
  registerApp,
  listOwnApps,
  listApprovedApps,
  reviewApp,
  listInstallations,
  listConsentSites,
  authorizeInstall,
  exchangeAuthorizationCode,
  refreshAccessToken,
  uninstallInstallation,
  authenticateAccessToken,
};
