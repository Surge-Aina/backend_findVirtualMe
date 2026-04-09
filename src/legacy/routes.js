/**
 * Legacy verticals: re-exports routers and photographer Drive OAuth wiring.
 * HTTP paths are unchanged (see unified refactoring plan Phase 1 Batch B2).
 */
const fs = require("fs");
const {
  setCredentialsFromEnv,
  getAuthUrl,
  getTokensFromCode,
} = require("./photographer/oauth-handler");

function runOAuthEnvSetup() {
  setCredentialsFromEnv();
}

function registerPhotographerOAuthRoutes(app) {
  app.get("/auth-url", (req, res) => {
    res.send(getAuthUrl());
  });

  app.get("/oauth2callback", async (req, res) => {
    const code = req.query.code;
    try {
      const tokens = await getTokensFromCode(code);

      if (tokens.refresh_token) {
        fs.appendFileSync(".env", `\nREFRESH_TOKEN=${tokens.refresh_token}`);
      }

      res.send("Authorization successful! You can close this tab.");
    } catch (err) {
      console.error("Error exchanging code:", err);
      res.status(500).send("Auth failed");
    }
  });
}

module.exports = {
  runOAuthEnvSetup,
  registerPhotographerOAuthRoutes,
  projectManagerPortfolioRoutes: require("./project-manager/routes/portfolioRoute"),
  settingsRoutes: require("./photographer/routes/settingsRoute"),
  driveRoutes: require("./photographer/routes/driveRoute"),
  photoRoutes: require("./photographer/routes/photoRoute"),
  testimonialRoutes: require("./data-scientist/routes/testimonialRoute"),
  dashboardRoutes: require("./data-scientist/routes/dashboardRoute"),
  bannerRoutes: require("./local-vendor/routes/bannerRoutes"),
  aboutRoutes: require("./local-vendor/routes/aboutRoutes"),
  menuRoutes: require("./local-vendor/routes/menuRoutes"),
  galleryRoutes: require("./local-vendor/routes/galleryRoutes"),
  reviewRoutes: require("./local-vendor/routes/reviewRoutes"),
  taggedImageRoutes: require("./local-vendor/routes/taggedImageRoutes"),
  handymanPortfolioRoutes: require("./handyman/routes/handymanPortfolioRoutes"),
  dataScientistRoutes: require("./data-scientist/routes/dataScientistRoutes"),
  handymanTemplateRoutes: require("./handyman/routes/handymanTemplateRoutes"),
  handymanInquiryRoutes: require("./handyman/routes/handymanInquiryRoutes"),
  localVendorRoutes: require("./local-vendor/routes/localVendorRoutes"),
  healthcareRoutes: require("./healthcare/routes/healthcare_routes"),
};
