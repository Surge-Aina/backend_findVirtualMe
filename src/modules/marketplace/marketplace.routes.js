const express = require("express");
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");
const { sendError } = require("../public-api/errors");
const {
  MarketplaceError,
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
} = require("./oauth.service");

function handle(err, res) {
  if (err instanceof MarketplaceError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("marketplace_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

function userId(req) {
  return req.user?._id || req.user?.id;
}

const developerApps = express.Router();
developerApps.use(auth);

developerApps.post("/", async (req, res) => {
  try {
    const result = await registerApp({
      ownerId: userId(req),
      name: req.body?.name,
      description: req.body?.description,
      redirectUris: req.body?.redirectUris,
      scopes: req.body?.scopes,
      webhookUrl: req.body?.webhookUrl,
    });
    const payload = {
      data: result.app,
      clientSecret: result.clientSecret,
      note: result.webhookSecret
        ? "Store the client secret and webhook signing secret now. They cannot be retrieved again."
        : "Store this client secret now. It cannot be retrieved again.",
    };
    if (result.webhookSecret) payload.webhookSecret = result.webhookSecret;
    return res.status(201).json(payload);
  } catch (err) {
    return handle(err, res);
  }
});

developerApps.get("/", async (req, res) => {
  try {
    const data = await listOwnApps(userId(req));
    return res.json({ data });
  } catch (err) {
    return handle(err, res);
  }
});

const developerInstallations = express.Router();
developerInstallations.use(auth);

developerInstallations.get("/", async (req, res) => {
  try {
    const data = await listInstallations(userId(req));
    return res.json({ data });
  } catch (err) {
    return handle(err, res);
  }
});

developerInstallations.delete("/:id", async (req, res) => {
  try {
    const data = await uninstallInstallation({ userId: userId(req), installationId: req.params.id });
    return res.json({ data });
  } catch (err) {
    return handle(err, res);
  }
});

const adminApps = express.Router();
adminApps.use(auth, roleCheck(["admin"]));

adminApps.post("/:id/review", async (req, res) => {
  try {
    const data = await reviewApp({ appId: req.params.id, reviewStatus: req.body?.reviewStatus });
    return res.json({ data });
  } catch (err) {
    return handle(err, res);
  }
});

const catalog = express.Router();
catalog.get("/", async (_req, res) => {
  try {
    const data = await listApprovedApps();
    return res.json({ data });
  } catch (err) {
    return handle(err, res);
  }
});

const oauth = express.Router();
oauth.use(express.urlencoded({ extended: false }));

function authorizeFields(source) {
  return {
    clientId: source.client_id,
    redirectUri: source.redirect_uri,
    scope: source.scope,
    state: source.state,
    codeChallenge: source.code_challenge,
    codeChallengeMethod: source.code_challenge_method,
    siteId: source.site_id,
  };
}

oauth.get("/authorize", auth, async (req, res) => {
  try {
    if (req.query.response_type !== "code") {
      return sendError(res, 400, "validation_error", "response_type must be code", {
        field: "response_type",
      });
    }
    if (!req.query.site_id) {
      const sites = await listConsentSites(userId(req));
      return res.json({ data: sites });
    }
    const data = await authorizeInstall({ userId: userId(req), ...authorizeFields(req.query) });
    return res.redirect(302, data.redirectUrl);
  } catch (err) {
    return handle(err, res);
  }
});

oauth.post("/authorize", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const data = await authorizeInstall({ userId: userId(req), ...authorizeFields(body) });
    return res.json({
      redirect_url: data.redirectUrl,
      code: data.code,
      scope: data.scopes.join(" "),
    });
  } catch (err) {
    return handle(err, res);
  }
});

oauth.post("/token", async (req, res) => {
  try {
    const body = req.body || {};
    if (body.grant_type === "authorization_code") {
      const token = await exchangeAuthorizationCode({
        code: body.code,
        redirectUri: body.redirect_uri,
        clientId: body.client_id,
        clientSecret: body.client_secret,
        codeVerifier: body.code_verifier,
      });
      return res.json(token);
    }
    if (body.grant_type === "refresh_token") {
      const token = await refreshAccessToken({
        refreshToken: body.refresh_token,
        clientId: body.client_id,
        clientSecret: body.client_secret,
      });
      return res.json(token);
    }
    return sendError(res, 400, "unsupported_grant", "grant_type is not supported");
  } catch (err) {
    return handle(err, res);
  }
});

module.exports = {
  developerApps,
  developerInstallations,
  adminApps,
  catalog,
  oauth,
};
