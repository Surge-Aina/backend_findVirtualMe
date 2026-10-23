/**
 * Legacy verticals: re-exports routers and photographer Drive OAuth wiring.
 * HTTP paths are unchanged (see unified refactoring plan Phase 1 Batch B2).
 */
const auth = require("../shared/middleware/auth");
const roleCheck = require("../shared/middleware/roleCheck");
const {
  setCredentialsFromEnv,
  getAuthUrl,
} = require("./photographer/oauth-handler");

function runOAuthEnvSetup() {
  setCredentialsFromEnv();
}

function registerPhotographerOAuthRoutes(app) {
  app.get("/auth-url", auth, roleCheck(["admin"]), (req, res) => {
    res.send(getAuthUrl());
  });

  // The browser redirect cannot carry our session. Exchanging the code here
  // used to overwrite the process Drive credential and append it to .env.
  app.get("/oauth2callback", (_req, res) => {
    res.status(403).send("OAuth callback is disabled");
  });
}

const projectManagerPortfolioRoutes = require("./project-manager/routes/portfolioRoute");
const settingsRoutes = require("./photographer/routes/settingsRoute");
const driveRoutes = require("./photographer/routes/driveRoute");
const photoRoutes = require("./photographer/routes/photoRoute");
const testimonialRoutes = require("./data-scientist/routes/testimonialRoute");
const dashboardRoutes = require("./data-scientist/routes/dashboardRoute");
const bannerRoutes = require("./local-vendor/routes/bannerRoutes");
const aboutRoutes = require("./local-vendor/routes/aboutRoutes");
const menuRoutes = require("./local-vendor/routes/menuRoutes");
const galleryRoutes = require("./local-vendor/routes/galleryRoutes");
const reviewRoutes = require("./local-vendor/routes/reviewRoutes");
const taggedImageRoutes = require("./local-vendor/routes/taggedImageRoutes");
const handymanPortfolioRoutes = require("./handyman/routes/handymanPortfolioRoutes");
const dataScientistRoutes = require("./data-scientist/routes/dataScientistRoutes");
const handymanTemplateRoutes = require("./handyman/routes/handymanTemplateRoutes");
const handymanInquiryRoutes = require("./handyman/routes/handymanInquiryRoutes");
const localVendorRoutes = require("./local-vendor/routes/localVendorRoutes");
const healthcareRoutes = require("./healthcare/routes/healthcare_routes");

/**
 * Mount legacy vertical routers at their current paths (Batch B6).
 */
function mountLegacy(app) {
  runOAuthEnvSetup();

  app.use("/portfolio", projectManagerPortfolioRoutes);
  app.use("/api/portfolio", projectManagerPortfolioRoutes);
  app.use("/settings", settingsRoutes);
  app.use("/drive", driveRoutes);
  app.use("/photo", photoRoutes);
  app.use("/testimonials", testimonialRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/banner", bannerRoutes);
  app.use("/about", aboutRoutes);
  app.use("/menu", menuRoutes);
  app.use("/gallery", galleryRoutes);
  app.use("/reviews", reviewRoutes);
  app.use("/tagged", taggedImageRoutes);
  app.use("/vendor", localVendorRoutes);
  app.use("/api/handyman/portfolio", handymanPortfolioRoutes);
  app.use("/datascience-portfolio", dataScientistRoutes);
  app.use("/api/handyman-template", handymanTemplateRoutes);
  app.use("/api/handyman/inquiries", handymanInquiryRoutes);
  app.use("/healthcare", healthcareRoutes);

  registerPhotographerOAuthRoutes(app);
}

module.exports = {
  runOAuthEnvSetup,
  registerPhotographerOAuthRoutes,
  mountLegacy,
  projectManagerPortfolioRoutes,
  settingsRoutes,
  driveRoutes,
  photoRoutes,
  testimonialRoutes,
  dashboardRoutes,
  bannerRoutes,
  aboutRoutes,
  menuRoutes,
  galleryRoutes,
  reviewRoutes,
  taggedImageRoutes,
  handymanPortfolioRoutes,
  dataScientistRoutes,
  handymanTemplateRoutes,
  handymanInquiryRoutes,
  localVendorRoutes,
  healthcareRoutes,
};
