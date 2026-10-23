const apiKeyService = require("./apiKey.service");
const { authenticateAccessToken } = require("../marketplace/oauth.service");
const { sendError } = require("./errors");

const INVALID_KEY = {
  status: 401,
  code: "invalid_api_key",
  message: "Invalid or revoked API key",
};

async function authenticateApiKey(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
      return sendError(res, INVALID_KEY.status, INVALID_KEY.code, INVALID_KEY.message);
    }

    const secret = header.slice("Bearer ".length).trim();
    if (secret.startsWith("fvm_at_")) {
      const oauth = await authenticateAccessToken(secret);
      if (!oauth) {
        return sendError(res, INVALID_KEY.status, INVALID_KEY.code, INVALID_KEY.message);
      }
      if (oauth.user.isActive === false) {
        return sendError(res, 403, "account_inactive", "Account is inactive");
      }
      req.publicApi = {
        user: oauth.user,
        key: { scopes: oauth.scopes, _id: oauth.installation._id },
        appId: oauth.installation.appId,
        installationId: oauth.installation._id,
        authType: "oauth",
      };
      return next();
    }
    const auth = await apiKeyService.authenticate(secret);
    if (!auth) {
      return sendError(res, INVALID_KEY.status, INVALID_KEY.code, INVALID_KEY.message);
    }
    if (auth.user.isActive === false) {
      return sendError(res, 403, "account_inactive", "Account is inactive");
    }

    await apiKeyService.recordKeyUse(auth.key._id);
    req.publicApi = auth;
    return next();
  } catch (_err) {
    console.error("public_api_auth_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
}

function requireScope(scope) {
  return function requireScopeMiddleware(req, res, next) {
    const scopes = req.publicApi?.key?.scopes || [];
    if (!scopes.includes(scope)) {
      return sendError(res, 403, "insufficient_scope", "API key is missing a required scope", {
        requiredScope: scope,
      });
    }
    return next();
  };
}

module.exports = {
  authenticateApiKey,
  requireScope,
};
