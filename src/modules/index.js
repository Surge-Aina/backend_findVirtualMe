/**
 * Barrel: mount all non-legacy HTTP modules (Batch B6).
 * Legacy verticals are mounted via ../legacy/routes mountLegacy().
 */
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const userRoutes = require("../../routes/userRoute");
const checkoutRoutes = require("./payments/checkout.routes");
const subscriptionRoutes = require("./payments/subscriptions.routes");
const supportFormRoutes = require("./support/support.routes");
const roleCheck = require("../shared/middleware/roleCheck");
const auth = require("../shared/middleware/auth");
const domainRoutes = require("./domains/domains.routes");
const telemetryRoutes = require("./telemetry/telemetry.routes");
const guestUserRoutes = require("./auth/guestLogin/guestUser.routes");
const portfolioEditLogRoutes = require("./portfolios/portfolio-edit-log.routes");
const guestAdminPanelRoutes = require("./auth/guestAdminPanel/guestAdminPanel.routes");
const socialLinksRoutes = require("./social-links/socialLinks.routes");
const userPortfoliosArrayRoutes = require("./portfolios/userPortfoliosArray/userPortfoliosArray.routes.js");
const publicPortfoliosRoutes = require("./portfolios/publicPortfolios/publicPortfolios.routes");
const domainPaymentRouter = require("./payments/domain-payment/stripe/stripe.route");
const emailMvpRoutes = require("./emailmvp/emailmvp.routes");
const googleLoginRoutes = require("./auth/googleLogin/googleLogin.routes.js");
const contactMeRoutes = require("./contact/contactMeForm.routes.js");
const domainRouterRoutes = require("./domains/DomainRouter/DomainRouter.routes.js");
const s3UploadRoutes = require("./media/S3Upload.routes.js");
const passwordResetRoutes = require("./auth/passwordReset/passwordReset.routes");
const portfolioRoutes = require("./portfolios/portfolio.routes");
const voucherRoutes = require("./vouchers/voucher.routes.js");
const qrCodeRoutes = require("./qr-code/qrCode.routes.js");
const privacyPolicyRoutes = require("./privacy-policy/privacyPolicy.routes");
const termsOfServiceRoutes = require("./terms-of-service/termsOfService.routes");
const config = require("../shared/config/app.config.js");

const nowIso = () => new Date().toISOString();

function mountModules(app) {
  app.get("/api/domain-context", (req, res) => {
    if (!req.domainContext) {
      return res.json({ mapped: false });
    }

    res.json({
      mapped: true,
      ...req.domainContext,
    });
  });

  app.get("/test-route", (req, res) => {
    res.json({
      message: "Test route is working!",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/checkout", auth, checkoutRoutes);
  app.use("/subscriptions", auth, roleCheck(["admin"]), subscriptionRoutes);
  app.use("/user", userRoutes);
  app.use("/support-form", supportFormRoutes);
  app.use("/api/domains", domainRoutes);
  app.use("/api/portfolio-edit-log", portfolioEditLogRoutes);

  const uploadsRoot = path.join(__dirname, "..", "..", config.uploads.directory);
  app.use("/uploads", express.static(uploadsRoot));

  app.get("/health", (_req, res) =>
    res.status(200).json({ ok: true, ts: Date.now() }),
  );

  app.use("/api/telemetry", telemetryRoutes);
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
  app.use("/api/portfolios", portfolioRoutes);
  app.use("/vouchers", voucherRoutes);
  app.use("/qrCode", qrCodeRoutes);
  app.use("/privacy-policy", privacyPolicyRoutes);
  app.use("/terms-of-service", termsOfServiceRoutes);
  app.use("/user", passwordResetRoutes);

  app.use("/api/mvp", emailMvpRoutes);

  app.get("/api/health", (_req, res) => {
    const readyState = mongoose.connection.readyState;
    const mongo = readyState === 1 ? "connected" : "disconnected";
    res.json({ ok: true, mongo, time: nowIso() });
  });

  app.set("config", config);

  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Back end is alive",
      timestamp: new Date().toISOString(),
    });
  });
}

module.exports = { mountModules };
