const { importSPKI, jwtVerify } = require("jose");
const User = require("../../../shared/models/User");
const BagglemeHandoffJti = require("./bagglemeHandoff.model");
const { buildLoginSuccessPayload } = require("../auth.service");

const ISSUER = "baggleme";
const AUDIENCE = "fvm";
const CLOCK_TOLERANCE_SEC = 5;
const MAX_FUTURE_EXP_SEC = 120;

let cachedPublicKey;
let cachedPublicKeyPem;

function handoffEnabled() {
  return process.env.BAGGLEME_HANDOFF_ENABLED === "true";
}

function normalizePem(pem) {
  if (!pem || typeof pem !== "string") return "";
  return pem.replace(/\\n/g, "\n").trim();
}

function allowedHandoffUserIds() {
  const ids = new Set();
  const legacy = process.env.BAGGLEME_HANDOFF_USER_ID;
  if (typeof legacy === "string" && legacy.trim()) {
    ids.add(legacy.trim());
  }
  const list = process.env.BAGGLEME_HANDOFF_USER_IDS;
  if (typeof list === "string" && list.trim()) {
    for (const part of list.split(",")) {
      const id = part.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

async function getVerifyKey() {
  const pem = normalizePem(process.env.BAGGLEME_HANDOFF_PUBLIC_KEY);
  if (!pem) return null;
  if (pem === cachedPublicKeyPem && cachedPublicKey) return cachedPublicKey;
  cachedPublicKeyPem = pem;
  cachedPublicKey = await importSPKI(pem, "EdDSA");
  return cachedPublicKey;
}

async function consumeJti(jti) {
  try {
    await BagglemeHandoffJti.create({ jti });
    return true;
  } catch (err) {
    if (err && err.code === 11000) return false;
    throw err;
  }
}

function assertExpNotTooFarFuture(exp) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    const err = new Error("invalid exp");
    err.code = "handoff_claims";
    throw err;
  }
  if (exp > nowSec + MAX_FUTURE_EXP_SEC) {
    const err = new Error("exp too far in future");
    err.code = "handoff_claims";
    throw err;
  }
}

async function verifyHandoffToken(handoffJwt) {
  if (!handoffEnabled()) {
    const err = new Error("disabled");
    err.code = "handoff_disabled";
    throw err;
  }

  const allowedIds = allowedHandoffUserIds();
  const verifyKey = await getVerifyKey();
  if (!allowedIds.size || !verifyKey) {
    const err = new Error("config");
    err.code = "handoff_config";
    throw err;
  }

  if (!handoffJwt || typeof handoffJwt !== "string") {
    const err = new Error("missing token");
    err.code = "handoff_missing_token";
    throw err;
  }

  let payload;
  try {
    const result = await jwtVerify(handoffJwt, verifyKey, {
      algorithms: ["EdDSA"],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SEC,
      requiredClaims: ["exp", "jti", "sub"],
    });
    payload = result.payload;
  } catch {
    const err = new Error("jwt verify failed");
    err.code = "handoff_jwt";
    throw err;
  }

  assertExpNotTooFarFuture(payload.exp);

  const sub = String(payload.sub);
  if (!allowedIds.has(sub)) {
    const err = new Error("sub not allowed");
    err.code = "handoff_claims";
    throw err;
  }

  const jti = String(payload.jti);
  if (!jti) {
    const err = new Error("missing jti");
    err.code = "handoff_claims";
    throw err;
  }

  const consumed = await consumeJti(jti);
  if (!consumed) {
    const err = new Error("replay");
    err.code = "handoff_replay";
    throw err;
  }

  const user = await User.findById(sub);
  if (!user) {
    const err = new Error("user missing");
    err.code = "handoff_user";
    throw err;
  }

  return buildLoginSuccessPayload(user);
}

function resetHandoffKeyCache() {
  cachedPublicKey = undefined;
  cachedPublicKeyPem = undefined;
}

module.exports = {
  handoffEnabled,
  verifyHandoffToken,
  resetHandoffKeyCache,
};