const express = require("express");
const { createOAuthMetadata, mcpAuthMetadataRouter } = require("@modelcontextprotocol/sdk/server/auth/router.js");
const { authorizationHandler } = require("@modelcontextprotocol/sdk/server/auth/handlers/authorize.js");
const { tokenHandler } = require("@modelcontextprotocol/sdk/server/auth/handlers/token.js");
const { clientRegistrationHandler } = require("@modelcontextprotocol/sdk/server/auth/handlers/register.js");
const { revocationHandler } = require("@modelcontextprotocol/sdk/server/auth/handlers/revoke.js");
const { metadataHandler } = require("@modelcontextprotocol/sdk/server/auth/handlers/metadata.js");
const { FindVirtualMeMcpOAuthProvider } = require("./mcpOAuthProvider");
const { renderConsentPage, WEB_LOGIN_HINT } = require("./consentPage");
const {
  getPendingAuthorization,
  completeConsent,
  consentLogin,
  verifyCsrf,
  normalizeScopes,
} = require("./mcpOAuth.service");
const { setConsentCookie, readConsentUserId } = require("./consentCookie");
const { throttleConsentByIp, throttleConsentByAccount } = require("./consentThrottle");
const { McpOAuthClientsStore } = require("./clientsStore");
const User = require("../../shared/models/User");
const {
  mcpOAuthIssuerUrl,
  mcpResourceUrl,
  MCP_OAUTH_CONSENT_SCOPES,
  publicApiBaseUrl,
  isMcpOAuthEnabled,
} = require("../../shared/config/mcpOAuth");

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieMiddleware(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  next();
}

function consentSecurityHeaders(_req, res, next) {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");
  next();
}

async function renderConsentView(res, pending, { loggedIn, username, error }) {
  const store = new McpOAuthClientsStore();
  const client = await store.getClient(pending.clientId);
  const html = renderConsentPage({
    ticket: pending.ticket,
    csrfToken: pending.csrfToken,
    clientName: client?.client_name || pending.clientId,
    requestedScopes: pending.requestedScopes?.length
      ? pending.requestedScopes
      : normalizeScopes(MCP_OAUTH_CONSENT_SCOPES),
    loggedIn,
    username,
    error,
  });
  return res.status(error ? 401 : 200).type("html").send(html);
}

let sharedProvider;

function getProvider() {
  if (!sharedProvider) sharedProvider = new FindVirtualMeMcpOAuthProvider();
  return sharedProvider;
}

function mountMcpOAuth(app) {
  if (!isMcpOAuthEnabled()) return;

  const issuerUrl = mcpOAuthIssuerUrl();
  const resourceUrl = mcpResourceUrl();
  const provider = getProvider();

  const oauthMetadata = createOAuthMetadata({
    provider,
    issuerUrl,
    scopesSupported: [...MCP_OAUTH_CONSENT_SCOPES],
    serviceDocumentationUrl: new URL("/api/public/docs", issuerUrl),
  });
  oauthMetadata.client_id_metadata_document_supported = true;

  const authRouter = express.Router();
  authRouter.use(new URL(oauthMetadata.authorization_endpoint).pathname, authorizationHandler({ provider }));
  authRouter.use(new URL(oauthMetadata.token_endpoint).pathname, tokenHandler({ provider }));
  authRouter.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: resourceUrl,
      scopesSupported: [...MCP_OAUTH_CONSENT_SCOPES],
      resourceName: "FindVirtualMe MCP",
      serviceDocumentationUrl: new URL("/api/public/docs", issuerUrl),
    })
  );
  if (oauthMetadata.registration_endpoint) {
    authRouter.use(
      new URL(oauthMetadata.registration_endpoint).pathname,
      clientRegistrationHandler({ clientsStore: provider.clientsStore })
    );
  }
  if (oauthMetadata.revocation_endpoint) {
    authRouter.use(new URL(oauthMetadata.revocation_endpoint).pathname, revocationHandler({ provider }));
  }

  const protectedResourceMetadata = {
    resource: resourceUrl.href,
    authorization_servers: [oauthMetadata.issuer],
    scopes_supported: [...MCP_OAUTH_CONSENT_SCOPES],
    resource_name: "FindVirtualMe MCP",
    resource_documentation: new URL("/api/public/docs", issuerUrl).href,
  };
  authRouter.use("/.well-known/oauth-protected-resource", metadataHandler(protectedResourceMetadata));

  app.use(authRouter);

  const consentRouter = express.Router();
  consentRouter.use(cookieMiddleware);
  consentRouter.use(consentSecurityHeaders);
  consentRouter.use(express.urlencoded({ extended: false }));

  consentRouter.get("/consent", async (req, res) => {
    try {
      const pending = await getPendingAuthorization(req.query.ticket);
      if (!pending) {
        return res.status(400).send("This authorization request expired or is invalid.");
      }
      const userId = readConsentUserId(req);
      let username = null;
      if (userId) {
        const user = await User.findById(userId).select("username").lean();
        username = user?.username;
      }
      return renderConsentView(res, pending, { loggedIn: !!userId, username, error: null });
    } catch (_err) {
      return res.status(400).send("Unable to load consent screen.");
    }
  });

  consentRouter.post("/consent", async (req, res) => {
    try {
      try {
        throttleConsentByIp(req.ip);
      } catch (err) {
        return res.status(err.status || 429).send(err.message);
      }

      const pending = await getPendingAuthorization(req.body?.ticket);
      if (!pending) {
        return res.status(400).send("This authorization request expired or is invalid.");
      }
      if (!verifyCsrf(pending, req.body?.csrf)) {
        return res.status(403).send("Invalid consent request.");
      }

      let userId = readConsentUserId(req);
      if (!userId) {
        try {
          throttleConsentByAccount(req.body?.email);
        } catch (err) {
          return res.status(err.status || 429).send(err.message);
        }

        const login = await consentLogin({
          email: req.body?.email,
          password: req.body?.password,
        });
        if (!login.ok) {
          const message =
            login.reason === "use_web_login"
              ? WEB_LOGIN_HINT
              : login.reason === "inactive"
                ? "This account is inactive."
                : "Invalid email or password.";
          return renderConsentView(res, pending, { loggedIn: false, username: null, error: message });
        }
        setConsentCookie(res, login.user._id);
        userId = String(login.user._id);
      }
      const scopes = Array.isArray(req.body.scopes)
        ? req.body.scopes
        : req.body.scopes
          ? [req.body.scopes]
          : [];
      const redirectUrl = await completeConsent({ ticket: pending.ticket, userId, scopes });
      return res.redirect(302, redirectUrl);
    } catch (err) {
      if (err.code === "validation_error") {
        return res.status(400).send(err.message);
      }
      return res.status(400).send("Unable to complete authorization.");
    }
  });

  app.use("/mcp-oauth", consentRouter);

  app.set("mcpOAuthResourceMetadataUrl", new URL("/.well-known/oauth-protected-resource", issuerUrl).href);
  app.set("mcpOAuthResourceUrl", resourceUrl.href);
  app.set("publicApiBaseUrl", publicApiBaseUrl());
}

function mcpOAuthResourceMetadataUrl(app) {
  return app.get("mcpOAuthResourceMetadataUrl") || null;
}

module.exports = {
  mountMcpOAuth,
  getProvider,
  mcpOAuthResourceMetadataUrl,
};