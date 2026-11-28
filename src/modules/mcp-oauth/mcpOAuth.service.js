const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../shared/models/User");
const { hashKey, hashesEqual } = require("../public-api/apiKey.service");
const { isPublicApiScope } = require("../public-api/scopes");
const { MCP_OAUTH_CONSENT_SCOPES } = require("../../shared/config/mcpOAuth");
const McpOAuthCode = require("./models/mcpOAuthCode.model");
const McpOAuthToken = require("./models/mcpOAuthToken.model");
const McpOAuthPending = require("./models/mcpOAuthPending.model");
const McpOAuthClient = require("./models/mcpOAuthClient.model");
const {
  mcpAccessTtlMs,
  mcpRefreshTtlMs,
  mcpCodeTtlMs,
  mcpResourceUrl,
} = require("../../shared/config/mcpOAuth");
const { assertAllowedMcpOAuthRedirect } = require("./redirectAllowlist");

const ACCESS_PREFIX = "fvm_mcp_at_";
const REFRESH_PREFIX = "fvm_mcp_rt_";

const CONSENT_COOKIE = "fvm_mcp_consent";

function normalizeScopes(scopes) {
  const list = Array.isArray(scopes)
    ? scopes
    : typeof scopes === "string"
      ? scopes.split(/[,\s]+/).filter(Boolean)
      : [];
  const normalized = [];
  for (const scope of list) {
    if (!isPublicApiScope(scope) || !MCP_OAUTH_CONSENT_SCOPES.includes(scope)) continue;
    if (!normalized.includes(scope)) normalized.push(scope);
  }
  return normalized;
}

function pkceMatches(verifier, challenge) {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  if (typeof challenge !== "string" || challenge.length < 43 || challenge.length > 128) return false;
  const digest = crypto.createHash("sha256").update(verifier).digest("base64url");
  return hashesEqual(digest, challenge);
}

function resourceMatches(expected, provided) {
  if (!expected) return true;
  if (!provided) return false;
  return String(provided).replace(/\/$/, "") === String(expected).replace(/\/$/, "");
}

async function createPendingAuthorization({
  clientId,
  redirectUri,
  requestedScopes,
  codeChallenge,
  state,
  resource,
}) {
  assertAllowedMcpOAuthRedirect(redirectUri);
  const ticket = crypto.randomBytes(24).toString("base64url");
  await McpOAuthPending.create({
    ticket,
    clientId,
    redirectUri,
    requestedScopes: normalizeScopes(requestedScopes),
    codeChallenge,
    state: state || "",
    resource: resource ? String(resource) : mcpResourceUrl().href,
    expiresAt: new Date(Date.now() + mcpCodeTtlMs()),
  });
  return ticket;
}

async function getPendingAuthorization(ticket) {
  if (!ticket) return null;
  const doc = await McpOAuthPending.findOne({
    ticket,
    expiresAt: { $gt: new Date() },
  }).lean();
  return doc;
}

async function completeConsent({ ticket, userId, scopes }) {
  const pending = await McpOAuthPending.findOne({
    ticket,
    expiresAt: { $gt: new Date() },
  });
  if (!pending) return null;

  const granted = normalizeScopes(scopes);
  const requested = pending.requestedScopes?.length
    ? normalizeScopes(pending.requestedScopes)
    : [...MCP_OAUTH_CONSENT_SCOPES];
  const effective = requested.filter((s) => granted.includes(s));
  if (effective.length === 0) {
    const err = new Error("At least one scope is required");
    err.code = "validation_error";
    throw err;
  }

  const code = `fvm_mcp_code_${crypto.randomBytes(24).toString("base64url")}`;
  await McpOAuthCode.create({
    codeHash: hashKey(code),
    clientId: pending.clientId,
    userId,
    scopes: effective,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    resource: pending.resource || mcpResourceUrl().href,
    expiresAt: new Date(Date.now() + mcpCodeTtlMs()),
  });
  await McpOAuthPending.deleteOne({ _id: pending._id });

  const redirect = new URL(pending.redirectUri);
  redirect.searchParams.set("code", code);
  if (pending.state) redirect.searchParams.set("state", pending.state);
  return redirect.toString();
}

async function challengeForAuthorizationCode(clientId, authorizationCode) {
  const digest = hashKey(authorizationCode);
  const record = await McpOAuthCode.findOne({ codeHash: digest, clientId, usedAt: null }).lean();
  if (!record || !hashesEqual(record.codeHash, digest)) {
    throw new Error("Invalid authorization code");
  }
  return record.codeChallenge;
}

async function issueTokenPair({ userId, clientId, scopes, resource }) {
  await McpOAuthToken.updateMany({ userId, clientId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  const accessToken = `${ACCESS_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const refreshToken = `${REFRESH_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const now = Date.now();
  await McpOAuthToken.create({
    userId,
    clientId,
    scopes,
    accessTokenHash: hashKey(accessToken),
    refreshTokenHash: hashKey(refreshToken),
    accessExpiresAt: new Date(now + mcpAccessTtlMs()),
    refreshExpiresAt: new Date(now + mcpRefreshTtlMs()),
    resource: resource || mcpResourceUrl().href,
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: Math.floor(mcpAccessTtlMs() / 1000),
    scope: scopes.join(" "),
  };
}

async function exchangeAuthorizationCode({ clientId, code, codeVerifier, redirectUri, resource }) {
  const digest = hashKey(code);
  const record = await McpOAuthCode.findOneAndUpdate(
    { codeHash: digest, clientId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!record || !hashesEqual(record.codeHash, digest)) {
    throw new Error("Authorization code is invalid");
  }
  if (redirectUri && new URL(redirectUri).href !== record.redirectUri) {
    throw new Error("redirect_uri does not match");
  }
  if (codeVerifier !== undefined && !pkceMatches(codeVerifier, record.codeChallenge)) {
    throw new Error("PKCE verification failed");
  }
  if (!resourceMatches(record.resource, resource || record.resource)) {
    throw new Error("Invalid resource");
  }
  return issueTokenPair({
    userId: record.userId,
    clientId,
    scopes: record.scopes,
    resource: record.resource,
  });
}

async function exchangeRefreshToken({ clientId, refreshToken, scopes, resource }) {
  const digest = hashKey(refreshToken);
  const record = await McpOAuthToken.findOne({ refreshTokenHash: digest, clientId });
  if (!record || !hashesEqual(record.refreshTokenHash, digest)) {
    throw new Error("Refresh token is invalid");
  }
  if (record.revokedAt || record.refreshExpiresAt < new Date()) {
    throw new Error("Refresh token is invalid");
  }
  const consumed = await McpOAuthToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!consumed) throw new Error("Refresh token is invalid");
  if (!resourceMatches(record.resource, resource || record.resource)) {
    throw new Error("Invalid resource");
  }
  let effectiveScopes = record.scopes;
  if (scopes) {
    const requested = normalizeScopes(scopes);
    effectiveScopes = record.scopes.filter((s) => requested.includes(s));
    if (effectiveScopes.length === 0) throw new Error("Invalid scopes");
  }
  return issueTokenPair({
    userId: record.userId,
    clientId,
    scopes: effectiveScopes,
    resource: record.resource,
  });
}

async function revokeToken({ clientId, token, tokenTypeHint }) {
  const digest = hashKey(token);
  const query = { clientId, revokedAt: null };
  if (tokenTypeHint === "refresh_token") {
    await McpOAuthToken.updateMany({ ...query, refreshTokenHash: digest }, { $set: { revokedAt: new Date() } });
    return;
  }
  await McpOAuthToken.updateMany(
    {
      ...query,
      $or: [{ accessTokenHash: digest }, { refreshTokenHash: digest }],
    },
    { $set: { revokedAt: new Date() } }
  );
}

async function authenticateMcpOAuthAccessToken(secret) {
  if (typeof secret !== "string" || !secret.startsWith(ACCESS_PREFIX)) return null;
  const digest = hashKey(secret);
  const record = await McpOAuthToken.findOne({ accessTokenHash: digest, revokedAt: null }).lean();
  if (!record || !hashesEqual(record.accessTokenHash, digest) || record.accessExpiresAt < new Date()) {
    return null;
  }
  const user = await User.findById(record.userId).select("_id username role createdAt isActive");
  if (!user || user.isActive === false) return null;
  return { user, scopes: record.scopes, clientId: record.clientId, tokenId: record._id };
}

async function verifyAccessTokenForSdk(token) {
  const auth = await authenticateMcpOAuthAccessToken(token);
  if (!auth) throw new Error("Invalid or expired token");
  const record = await McpOAuthToken.findOne({ accessTokenHash: hashKey(token) }).lean();
  return {
    token,
    clientId: auth.clientId,
    scopes: auth.scopes,
    expiresAt: Math.floor(new Date(record.accessExpiresAt).getTime() / 1000),
    resource: record.resource ? new URL(record.resource) : mcpResourceUrl(),
    extra: { userId: String(auth.user._id) },
  };
}

async function verifyClientSecret(clientId, clientSecret) {
  const doc = await McpOAuthClient.findOne({ clientId, revokedAt: null }).lean();
  if (!doc || !doc.clientSecretHash) return false;
  return hashesEqual(hashKey(clientSecret || ""), doc.clientSecretHash);
}

function setConsentCookie(res, userId) {
  const token = jwt.sign({ id: String(userId), kind: "mcp_consent" }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
  res.cookie(CONSENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/mcp-oauth",
  });
}

function readConsentUserId(req) {
  const raw = req.cookies?.[CONSENT_COOKIE];
  if (!raw) return null;
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET);
    if (decoded.kind !== "mcp_consent" || !decoded.id) return null;
    return decoded.id;
  } catch (_err) {
    return null;
  }
}

async function consentLogin({ email, password }) {
  const user = await User.findOne({ email: String(email || "").trim().toLowerCase() });
  if (!user) return null;
  const valid = await bcrypt.compare(password || "", user.password);
  if (!valid) return null;
  if (user.isActive === false) return null;
  return user;
}

module.exports = {
  ACCESS_PREFIX,
  REFRESH_PREFIX,
  CONSENT_COOKIE,
  normalizeScopes,
  createPendingAuthorization,
  getPendingAuthorization,
  completeConsent,
  challengeForAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  revokeToken,
  authenticateMcpOAuthAccessToken,
  verifyAccessTokenForSdk,
  verifyClientSecret,
  setConsentCookie,
  readConsentUserId,
  consentLogin,
  pkceMatches,
};