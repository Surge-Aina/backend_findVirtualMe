const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../../shared/models/User");
const { hashKey, hashesEqual } = require("../public-api/apiKey.service");
const { isPublicApiScope } = require("../public-api/scopes");
const { MCP_OAUTH_CONSENT_SCOPES } = require("../../shared/config/mcpOAuth");
const McpOAuthCode = require("./models/mcpOAuthCode.model");
const McpOAuthToken = require("./models/mcpOAuthToken.model");
const McpOAuthPending = require("./models/mcpOAuthPending.model");
const {
  mcpAccessTtlMs,
  mcpRefreshTtlMs,
  mcpCodeTtlMs,
  mcpResourceUrl,
} = require("../../shared/config/mcpOAuth");
const { assertAllowedMcpOAuthRedirect } = require("./redirectAllowlist");
const { InvalidGrantError } = require("@modelcontextprotocol/sdk/server/auth/errors.js");

const ACCESS_PREFIX = "fvm_mcp_at_";
const REFRESH_PREFIX = "fvm_mcp_rt_";

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

async function revokeTokenFamily(tokenFamilyId) {
  if (!tokenFamilyId) return;
  await McpOAuthToken.updateMany(
    { tokenFamilyId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
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
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  await McpOAuthPending.create({
    ticket,
    clientId,
    redirectUri,
    requestedScopes: normalizeScopes(requestedScopes),
    codeChallenge,
    state: state || "",
    resource: resource ? String(resource) : mcpResourceUrl().href,
    csrfToken,
    expiresAt: new Date(Date.now() + mcpCodeTtlMs()),
  });
  return { ticket, csrfToken };
}

async function getPendingAuthorization(ticket) {
  if (!ticket) return null;
  const doc = await McpOAuthPending.findOne({
    ticket,
    expiresAt: { $gt: new Date() },
  }).lean();
  return doc;
}

function verifyCsrf(pending, submitted) {
  if (!pending?.csrfToken || !submitted || typeof submitted !== "string") return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(pending.csrfToken), Buffer.from(submitted));
  } catch (_err) {
    return false;
  }
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

  const tokenFamilyId = crypto.randomBytes(16).toString("hex");
  const code = `fvm_mcp_code_${crypto.randomBytes(24).toString("base64url")}`;
  await McpOAuthCode.create({
    codeHash: hashKey(code),
    clientId: pending.clientId,
    userId,
    scopes: effective,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    resource: pending.resource || mcpResourceUrl().href,
    tokenFamilyId,
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
  const record = await McpOAuthCode.findOne({ codeHash: digest, clientId }).lean();
  if (!record || !hashesEqual(record.codeHash, digest)) {
    throw new InvalidGrantError("Authorization code is invalid");
  }
  if (record.usedAt) {
    await revokeTokenFamily(record.tokenFamilyId);
    throw new InvalidGrantError("Authorization code is invalid");
  }
  if (record.expiresAt < new Date()) {
    throw new InvalidGrantError("Authorization code is invalid");
  }
  return record.codeChallenge;
}

async function issueTokenPair({ userId, clientId, scopes, resource, tokenFamilyId }) {
  await revokeTokenFamily(tokenFamilyId);
  const accessToken = `${ACCESS_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const refreshToken = `${REFRESH_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const now = Date.now();
  await McpOAuthToken.create({
    userId,
    clientId,
    tokenFamilyId,
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
  const existing = await McpOAuthCode.findOne({ codeHash: digest, clientId }).lean();
  if (!existing || !hashesEqual(existing.codeHash, digest)) {
    throw new InvalidGrantError("Authorization code is invalid");
  }
  if (existing.usedAt) {
    await revokeTokenFamily(existing.tokenFamilyId);
    throw new InvalidGrantError("Authorization code is invalid");
  }
  if (existing.expiresAt < new Date()) {
    throw new InvalidGrantError("Authorization code is invalid");
  }
  if (redirectUri && new URL(redirectUri).href !== existing.redirectUri) {
    throw new InvalidGrantError("redirect_uri does not match");
  }
  if (codeVerifier !== undefined && !pkceMatches(codeVerifier, existing.codeChallenge)) {
    throw new InvalidGrantError("code_verifier does not match the challenge");
  }
  if (!resourceMatches(existing.resource, resource || existing.resource)) {
    throw new InvalidGrantError("Invalid resource");
  }

  const record = await McpOAuthCode.findOneAndUpdate(
    { _id: existing._id, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!record) {
    await revokeTokenFamily(existing.tokenFamilyId);
    throw new InvalidGrantError("Authorization code is invalid");
  }

  return issueTokenPair({
    userId: record.userId,
    clientId,
    scopes: record.scopes,
    resource: record.resource,
    tokenFamilyId: record.tokenFamilyId,
  });
}

async function exchangeRefreshToken({ clientId, refreshToken, scopes, resource }) {
  const digest = hashKey(refreshToken);
  const record = await McpOAuthToken.findOne({ refreshTokenHash: digest, clientId }).lean();
  if (!record || !hashesEqual(record.refreshTokenHash, digest)) {
    throw new InvalidGrantError("Refresh token is invalid");
  }
  if (record.revokedAt) {
    await revokeTokenFamily(record.tokenFamilyId);
    throw new InvalidGrantError("Refresh token is invalid");
  }
  if (record.refreshExpiresAt < new Date()) {
    throw new InvalidGrantError("Refresh token is invalid");
  }

  const consumed = await McpOAuthToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!consumed) {
    await revokeTokenFamily(record.tokenFamilyId);
    throw new InvalidGrantError("Refresh token is invalid");
  }
  if (!resourceMatches(record.resource, resource || record.resource)) {
    throw new InvalidGrantError("Invalid resource");
  }
  let effectiveScopes = record.scopes;
  if (scopes) {
    const requested = normalizeScopes(scopes);
    effectiveScopes = record.scopes.filter((s) => requested.includes(s));
    if (effectiveScopes.length === 0) throw new InvalidGrantError("Invalid scope");
  }
  return issueTokenPair({
    userId: record.userId,
    clientId,
    scopes: effectiveScopes,
    resource: record.resource,
    tokenFamilyId: record.tokenFamilyId,
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
  if (!auth) throw new InvalidGrantError("Invalid or expired token");
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

async function consentLogin({ email, password }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "invalid_credentials" };
  const user = await User.findOne({ email: normalized });
  if (!user) return { ok: false, reason: "invalid_credentials" };
  if (user.isActive === false) return { ok: false, reason: "inactive" };
  if (user.authProvider === "google" || user.googleId) {
    return { ok: false, reason: "use_web_login" };
  }
  if (!user.password) {
    return { ok: false, reason: "use_web_login" };
  }
  let valid;
  try {
    valid = await bcrypt.compare(password || "", user.password);
  } catch (_err) {
    return { ok: false, reason: "use_web_login" };
  }
  if (!valid) return { ok: false, reason: "invalid_credentials" };
  return { ok: true, user };
}

module.exports = {
  ACCESS_PREFIX,
  REFRESH_PREFIX,
  normalizeScopes,
  createPendingAuthorization,
  getPendingAuthorization,
  verifyCsrf,
  completeConsent,
  challengeForAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  revokeToken,
  revokeTokenFamily,
  authenticateMcpOAuthAccessToken,
  verifyAccessTokenForSdk,
  consentLogin,
  pkceMatches,
};