const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiKey = require("./apiKey.model");
const User = require("../../shared/models/User");
const { isPublicApiScope } = require("./scopes");

const KEY_PREFIX = "fvm_";
const PREFIX_LENGTH = 12;
const LAST_USED_THROTTLE_MS = 60 * 1000;
const DEFAULT_MAX_ACTIVE_KEYS = 25;

class ApiKeyError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiKeyError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readMaxActiveKeys() {
  const raw = process.env.PUBLIC_API_MAX_ACTIVE_KEYS;
  if (raw === undefined || raw === "") return DEFAULT_MAX_ACTIVE_KEYS;
  if (!/^\d+$/.test(raw)) return DEFAULT_MAX_ACTIVE_KEYS;
  const parsed = Number(raw);
  if (parsed < 1 || parsed > 100) return DEFAULT_MAX_ACTIVE_KEYS;
  return parsed;
}

function hashKey(secret) {
  const pepper = process.env.PUBLIC_API_KEY_PEPPER || "";
  return crypto.createHash("sha256").update(`${pepper}:${secret}`).digest("hex");
}

function generateSecret() {
  const body = crypto.randomBytes(32).toString("base64url");
  const secret = `${KEY_PREFIX}${body}`;
  return { secret, prefix: secret.slice(0, PREFIX_LENGTH) };
}

function presentKey(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name || null,
    prefix: doc.prefix,
    scopes: Array.isArray(doc.scopes) ? [...doc.scopes] : [],
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt || null,
    revokedAt: doc.revokedAt || null,
    replacedBy: doc.replacedBy ? doc.replacedBy.toString() : null,
  };
}

function normalizeName(name) {
  if (name === undefined || name === null || name === "") return null;
  if (typeof name !== "string") {
    throw new ApiKeyError(400, "validation_error", "name must be a string", {
      field: "name",
    });
  }
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new ApiKeyError(
      400,
      "validation_error",
      "name must be 80 characters or fewer and cannot include control characters",
      { field: "name" }
    );
  }
  return trimmed;
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new ApiKeyError(
      400,
      "validation_error",
      "scopes must be a non-empty array of supported read scopes",
      { field: "scopes" }
    );
  }
  const normalized = [];
  for (const scope of scopes) {
    if (typeof scope !== "string" || !isPublicApiScope(scope)) {
      throw new ApiKeyError(
        400,
        "validation_error",
        "scopes must be a non-empty array of supported read scopes",
        { field: "scopes" }
      );
    }
    if (!normalized.includes(scope)) normalized.push(scope);
  }
  return normalized;
}

function assertUserId(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ApiKeyError(401, "unauthorized", "Authentication required");
  }
}

async function insertKey({ userId, name, scopes }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = generateSecret();
    try {
      const doc = await ApiKey.create({
        userId,
        name,
        scopes,
        prefix: generated.prefix,
        keyHash: hashKey(generated.secret),
      });
      return { doc, secret: generated.secret };
    } catch (err) {
      if (err && err.code === 11000 && attempt === 0) continue;
      throw err;
    }
  }
  throw new ApiKeyError(500, "internal_error", "Internal server error");
}

async function createKey({ userId, name, scopes, replacingId = null }) {
  assertUserId(userId);
  const normalizedName = normalizeName(name);
  const normalizedScopes = normalizeScopes(scopes);

  const countFilter = { userId, revokedAt: null };
  if (replacingId) countFilter._id = { $ne: replacingId };
  const activeCount = await ApiKey.countDocuments(countFilter);
  if (activeCount >= readMaxActiveKeys()) {
    throw new ApiKeyError(
      409,
      "key_limit",
      "Active API key limit reached for this account"
    );
  }

  const created = await insertKey({
    userId,
    name: normalizedName,
    scopes: normalizedScopes,
  });
  return { apiKey: presentKey(created.doc), secret: created.secret };
}

async function listKeys(userId) {
  assertUserId(userId);
  const docs = await ApiKey.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  return docs.map(presentKey);
}

async function findOwnedKey(userId, keyId) {
  assertUserId(userId);
  if (!mongoose.isValidObjectId(keyId)) {
    throw new ApiKeyError(404, "not_found", "API key not found");
  }
  const doc = await ApiKey.findOne({ _id: keyId, userId });
  if (!doc) throw new ApiKeyError(404, "not_found", "API key not found");
  return doc;
}

async function revokeKey({ userId, keyId }) {
  const doc = await findOwnedKey(userId, keyId);
  if (!doc.revokedAt) {
    doc.revokedAt = new Date();
    await doc.save();
  }
  return presentKey(doc);
}

async function rotateKey({ userId, keyId }) {
  const existing = await findOwnedKey(userId, keyId);
  if (existing.revokedAt) {
    throw new ApiKeyError(409, "key_revoked", "Revoked API keys cannot be rotated");
  }

  const created = await createKey({
    userId,
    name: existing.name,
    scopes: existing.scopes,
    replacingId: existing._id,
  });

  existing.revokedAt = new Date();
  existing.replacedBy = created.apiKey.id;
  await existing.save();

  return {
    apiKey: created.apiKey,
    secret: created.secret,
    revokedKeyId: existing._id.toString(),
  };
}

async function touchLastUsed(keyId) {
  const staleBefore = new Date(Date.now() - LAST_USED_THROTTLE_MS);
  await ApiKey.updateOne(
    {
      _id: keyId,
      revokedAt: null,
      $or: [{ lastUsedAt: null }, { lastUsedAt: { $lte: staleBefore } }],
    },
    { $set: { lastUsedAt: new Date() } }
  );
}

/**
 * Resolve a bearer secret to its owning account.
 * Returns null for unknown, malformed, or revoked secrets.
 * The plaintext secret is not logged and is not attached to the result.
 */
async function authenticate(secret) {
  if (
    typeof secret !== "string" ||
    !secret.startsWith(KEY_PREFIX) ||
    secret.startsWith("fvm_at_") ||
    secret.length > 200
  ) {
    return null;
  }
  const key = await ApiKey.findOne({ keyHash: hashKey(secret), revokedAt: null });
  if (!key) return null;

  const user = await User.findById(key.userId).select(
    "_id username role createdAt isActive"
  );
  if (!user) return null;
  return { key, user };
}

module.exports = {
  ApiKeyError,
  hashKey,
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  authenticate,
  recordKeyUse: touchLastUsed,
};
