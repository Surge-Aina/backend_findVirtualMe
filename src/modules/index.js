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
const authHttpRoutes = require("./auth/auth.http.routes");
const contactMeRoutes = require("./contact/contactMeForm.routes.js");
const domainRouterRoutes = require("./domains/DomainRouter/DomainRouter.routes.js");
const s3UploadRoutes = require("./media/S3Upload.routes.js");
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

  app.use("/api/payments/checkout", auth, checkoutRoutes);
  app.use("/api/payments/subscriptions", auth, roleCheck(["admin"]), subscriptionRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/support", supportFormRoutes);
  app.use("/api/domains", domainRoutes);
  app.use("/api/portfolios/edit-log", portfolioEditLogRoutes);

  const uploadsRoot = path.join(__dirname, "..", "..", config.uploads.directory);
  app.use("/uploads", express.static(uploadsRoot));

  app.get("/health", (_req, res) =>
    res.status(200).json({ ok: true, ts: Date.now() }),
  );

  app.use("/api/telemetry", telemetryRoutes);
  app.use("/api/auth/guest", guestUserRoutes);
  app.use("/api/auth/guest-admin", guestAdminPanelRoutes);
  app.use("/api/social-links", socialLinksRoutes);
  app.use("/api/portfolios/user-array", userPortfoliosArrayRoutes);
  app.use("/api/portfolios/public", publicPortfoliosRoutes);
  app.use("/api/payments", domainPaymentRouter);
  app.use("/api/auth", authHttpRoutes);
  app.use("/api/contact", contactMeRoutes);
  app.use("/api/domains/router", domainRouterRoutes);
  app.use("/api/media/s3-upload-url", s3UploadRoutes);
  app.use("/api/portfolios", portfolioRoutes);
  app.use("/api/vouchers", voucherRoutes);
  app.use("/api/qr-codes", qrCodeRoutes);
  app.use("/api/legal/privacy-policy", privacyPolicyRoutes);
  app.use("/api/legal/terms-of-service", termsOfServiceRoutes);

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
