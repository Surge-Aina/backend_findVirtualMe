const express = require("express");
require("dotenv").config(); // Load environment variables from .env file
const path = require("path");
const userRoutes = require("../routes/userRoute");
const checkoutRoutes = require("../routes/stripePayment/checkoutRoutes");
const subscriptionRoutes = require("../routes/subscriptionRoutes");
const stripeWebhookRoutes = require("../routes/stripeWebhookRoutes");
const supportFormRoutes = require("../routes/supportFormRoutes");
const roleCheck = require("./shared/middleware/roleCheck");
const auth = require("./shared/middleware/auth");
const domainRoutes = require("../routes/domainRoutes");
const telemetryRoutes = require("../routes/telemetry");
const guestUserRoutes = require("./modules/auth/guestLogin/guestUser.routes");
const portfolioEditLogRoutes = require("./modules/portfolios/portfolio-edit-log.routes");
const guestAdminPanelRoutes = require("./modules/auth/guestAdminPanel/guestAdminPanel.routes");
const socialLinksRoutes = require("../microservices/socialLinks/socialLinks.routes");
const userPortfoliosArrayRoutes = require("./modules/portfolios/userPortfoliosArray/userPortfoliosArray.routes.js");
const publicPortfoliosRoutes = require("./modules/portfolios/publicPortfolios/publicPortfolios.routes");
const domainPaymentRouter = require("../microservices/domainPayment/stripe/stripe.route");
const emailMvpRoutes = require("../microservices/emailmvp/emailmvp.routes");
const googleLoginRoutes = require("./modules/auth/googleLogin/googleLogin.routes.js");
const contactMeRoutes = require("../microservices/contactMeForm/contactMeForm.routes.js");
const domainRouterRoutes = require("../microservices/DomainRouter/DomainRouter.routes.js");
const s3UploadRoutes = require("../microservices/S3Upload/S3Upload.routes.js");
const passwordResetRoutes = require("./modules/auth/passwordReset/passwordReset.routes");

const config = require("./shared/config/app.config.js");
const corsMiddleware = require("./shared/middleware/cors.middleware");
const legacy = require("./legacy/routes");

const {
  runOAuthEnvSetup,
  registerPhotographerOAuthRoutes,
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
} = legacy;

const app = express();

app.use(corsMiddleware);

app.set("trust proxy", true);

//stripe webhook(must be before app.use(express.json()))
//do not call directly, stripe will call this route
app.use("/stripe-webhook", stripeWebhookRoutes);

app.use(express.json({ limit: "1mb" }));

app.get("/api/domain-context", (req, res) => {
  if (!req.domainContext) {
    return res.json({ mapped: false });
  }

  res.json({
    mapped: true,
    ...req.domainContext,
  });
});

runOAuthEnvSetup();

// Mount the main portfolio API routes at /portfolio
app.use("/portfolio", projectManagerPortfolioRoutes);

// Test route to verify routing is working
app.get("/test-route", (req, res) => {
  res.json({
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
  });
});

//stripe payment
app.use("/checkout", auth, checkoutRoutes);
//IT admin routes to handle user subscriptions
app.use("/subscriptions", auth, roleCheck(["admin"]), subscriptionRoutes);
app.use("/user", userRoutes); //onboarding now routes here
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
app.use("/support-form", supportFormRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/portfolio-edit-log", portfolioEditLogRoutes);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() }),
);
app.use("/healthcare", healthcareRoutes);
app.use("/api/telemetry", telemetryRoutes);

//microservices
app.use("/guestUser", guestUserRoutes);
app.use("/guestAdminPanel", guestAdminPanelRoutes);
app.use("/social-links", socialLinksRoutes);
app.use("/userPortfoliosArray", userPortfoliosArrayRoutes);
app.use("/publicPortfolios", publicPortfoliosRoutes);
app.use("/api/domainPayment", domainPaymentRouter);
app.use("/google-login/", googleLoginRoutes);
app.use("/contactMe", contactMeRoutes);
app.use("/domainRouter", domainRouterRoutes);
app.use("/s3-upload-url", s3UploadRoutes);
app.use("/api/portfolios", require("./modules/portfolios/portfolio.routes"));
app.use("/vouchers", require("../microservices/vouchers/voucher.routes.js"));
app.use("/qrCode", require("../microservices/qrCode/qrCode.routes.js"));
app.use(
  "/privacy-policy",
  require("../microservices/privacyPolicy/privacyPolicy.routes"),
);
app.use(
  "/terms-of-service",
  require("../microservices/termsOfService/termsOfService.routes"),
);
app.use("/user", passwordResetRoutes);

app.use("/api/mvp", emailMvpRoutes);
const mongoose = require("mongoose");
const nowIso = () => new Date().toISOString();
app.get("/api/health", (_req, res) => {
  const readyState = mongoose.connection.readyState; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  const mongo = readyState === 1 ? "connected" : "disconnected";
  res.json({ ok: true, mongo, time: nowIso() });
});

// Serve static files from uploads directory
app.use(
  `/${config.uploads.directory}`,
  express.static(path.join(__dirname, "..", config.uploads.directory)),
);
// Make config available to the app
app.set("config", config);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Back end is alive",
    timestamp: new Date().toISOString(),
  });
});

registerPhotographerOAuthRoutes(app);

module.exports = app;
