const express = require("express");
require("dotenv").config();

const corsMiddleware = require("./shared/middleware/cors.middleware");
const stripeWebhookRoutes = require("./modules/payments/stripe-webhook.routes");
const { mountModules } = require("./modules");
const { mountLegacy } = require("./legacy/routes");

const app = express();

app.use(corsMiddleware);
app.set("trust proxy", true);

// Stripe webhook must run before express.json()
app.use("/api/payments/webhooks", stripeWebhookRoutes);
// Production Stripe endpoints still post to the pre-refactor paths.
app.use("/stripe-webhook", stripeWebhookRoutes);

app.use(express.json({ limit: "1mb" }));

mountModules(app);
mountLegacy(app);

app.use((err, req, res, next) => {
  if (!err) return next();
  const message = String(err.message || "");
  if (
    message === "Not allowed by CORS" ||
    message === "Invalid origin" ||
    message === "CORS validation failed"
  ) {
    return res.status(403).json({
      error: { code: "origin_not_allowed", message: "Origin not allowed" },
    });
  }
  if (res.headersSent) return next(err);
  console.error("unhandled_error", message);
  return res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
});

module.exports = app;
