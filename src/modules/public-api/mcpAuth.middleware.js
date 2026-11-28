const { sendError } = require("./errors");
const apiKeyService = require("./apiKey.service");
const { authenticateAccessToken } = require("../marketplace/oauth.service");
const { authenticateMcpOAuthAccessToken, ACCESS_PREFIX } = require("../mcp-oauth/mcpOAuth.service");
const { isMcpOAuthEnabled } = require("../../shared/config/mcpOAuth");
const { mcpOAuthResourceMetadataUrl } = require("../mcp-oauth/mount");

const INVALID_KEY = {
  status: 401,
  code: "invalid_api_key",
  message: "Invalid or revoked API key",
};

function buildWwwAuthenticate(req, message) {
  const app = req.app;
  const metadata = mcpOAuthResourceMetadataUrl(app);
  let header = `Bearer error="invalid_token", error_description="${message || "Authentication required"}"`;
  if (metadata) {
    header += `, resource_metadata="${metadata}"`;
  }
  return header;
}

function sendMcpUnauthorized(res, req, message) {
  if (isMcpOAuthEnabled()) {
    res.set("WWW-Authenticate", buildWwwAuthenticate(req, message));
    return res.status(401).json({
      error: "invalid_token",
      error_description: message || "Authentication required",
    });
  }
  return sendError(res, INVALID_KEY.status, INVALID_KEY.code, INVALID_KEY.message);
}

async function authenticateMcpRequest(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
      return sendMcpUnauthorized(res, req, "Missing Bearer token");
    }

    const secret = header.slice("Bearer ".length).trim();

    if (secret.startsWith("fvm_at_")) {
      const oauth = await authenticateAccessToken(secret);
      if (!oauth) {
        return sendMcpUnauthorized(res, req, "Invalid or expired token");
      }
      if (oauth.user.isActive === false) {
        return sendError(res, 403, "account_inactive", "Account is inactive");
      }
      req.publicApi = {
        user: oauth.user,
        key: { scopes: oauth.scopes, _id: oauth.installation._id },
        appId: oauth.installation.appId,
        installationId: oauth.installation._id,
        siteId: oauth.installation.siteId,
        authType: "oauth",
      };
      return next();
    }

    if (secret.startsWith(ACCESS_PREFIX)) {
      if (!isMcpOAuthEnabled()) {
        return sendError(res, INVALID_KEY.status, INVALID_KEY.code, INVALID_KEY.message);
      }
      const oauth = await authenticateMcpOAuthAccessToken(secret);
      if (!oauth) {
        return sendMcpUnauthorized(res, req, "Invalid or expired token");
      }
      req.publicApi = {
        user: oauth.user,
        key: { scopes: oauth.scopes, _id: oauth.tokenId },
        authType: "mcp_oauth",
        mcpOAuthClientId: oauth.clientId,
      };
      return next();
    }

    const auth = await apiKeyService.authenticate(secret);
    if (!auth) {
      return sendMcpUnauthorized(res, req, "Invalid or expired token");
    }
    if (auth.user.isActive === false) {
      return sendError(res, 403, "account_inactive", "Account is inactive");
    }

    await apiKeyService.recordKeyUse(auth.key._id);
    req.publicApi = auth;
    return next();
  } catch (_err) {
    console.error("mcp_auth_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
}

module.exports = {
  authenticateMcpRequest,
  buildWwwAuthenticate,
};