const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const CONSENT_COOKIE = "fvm_mcp_consent";
const CONSENT_JWT_AUDIENCE = "fvm.mcp.oauth.consent";

function consentJwtSecret() {
  const dedicated = process.env.MCP_OAUTH_COOKIE_SECRET;
  if (dedicated && String(dedicated).trim()) return String(dedicated).trim();
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error("JWT_SECRET is required for MCP consent cookies");
  return crypto.hkdfSync("sha256", base, "", "fvm-mcp-oauth-consent-cookie-v1", 32);
}

function setConsentCookie(res, userId) {
  const token = jwt.sign(
    { sub: String(userId), kind: "mcp_consent" },
    consentJwtSecret(),
    { expiresIn: "2h", audience: CONSENT_JWT_AUDIENCE }
  );
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
    const decoded = jwt.verify(raw, consentJwtSecret(), {
      audience: CONSENT_JWT_AUDIENCE,
    });
    if (decoded.kind !== "mcp_consent" || !decoded.sub) return null;
    return decoded.sub;
  } catch (_err) {
    return null;
  }
}

module.exports = {
  CONSENT_COOKIE,
  CONSENT_JWT_AUDIENCE,
  consentJwtSecret,
  setConsentCookie,
  readConsentUserId,
};