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
app.use("/stripe-webhook", stripeWebhookRoutes);

app.use(express.json({ limit: "1mb" }));

mountModules(app);
mountLegacy(app);

module.exports = app;
