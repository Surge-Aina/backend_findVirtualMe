const express = require("express");
const connectDB = require("./utils/db"); // Import database connection from utils
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env file
const path = require("path");
const fs = require("fs");
const http = require("http");
const socketIo = require("socket.io");
const { google } = require("googleapis");
const {
  oauth2Client,
  getAuthUrl,
  getTokensFromCode,
  setCredentialsFromEnv,
  listFilesInFolder,
} = require("./oauthHandler");
const healthcareRoutes = require("./routes/healthcare/healthcare_routes");
const settingsRoutes = require("./routes/photographer/settingsRoute");
const driveRoutes = require("./routes/photographer/driveRoute");
const photoRoutes = require("./routes/photographer/photoRoute");
const userRoutes = require("./routes/userRoute");
const projectManagerPortfolioRoutes = require("./routes/projectManager/portfolioRoute");
const softwareEngRoutes = require("./routes/softwareEngineer/portfolio");
const testimonialRoutes = require("./routes/dataScientist/testimonialRoute");
const dashboardRoutes = require("./routes/dataScientist/dashboardRoute");
const bannerRoutes = require("./routes/localFoodVendor/bannerRoutes");
const aboutRoutes = require("./routes/localFoodVendor/aboutRoutes");
const menuRoutes = require("./routes/localFoodVendor/menuRoutes");
const galleryRoutes = require("./routes/localFoodVendor/galleryRoutes");
const reviewRoutes = require("./routes/localFoodVendor/reviewRoutes");
const taggedImageRoutes = require("./routes/localFoodVendor/taggedImageRoutes");
const handymanPortfolioRoutes = require("./routes/handyMan/handymanPortfolioRoutes");
const dataScientistRoutes = require("./routes/dataScientist/dataScientistRoutes");
const userRoutes2 = require("./routes/cleaningLady/userRoute2");
const checkoutRoutes = require("./routes/stripePayment/checkoutRoutes");
const authRoutes = require("./routes/auth"); // Import authentication routes
const seedUsers = require("./seed/users"); // Import seed users function
const domainResolver = require("./middleware/domainResolver"); // Import domain resolver
const handymanTemplateRoutes = require("./routes/handyMan/handymanTemplateRoutes");
const handymanInquiryRoutes = require("./routes/handyMan/handymanInquiryRoutes");
const localVendorRoutes = require("./routes/localFoodVendor/localVendorRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const stripeWebhookRoutes = require("./routes/stripeWebhookRoutes");
const supportFormRoutes = require("./routes/supportFormRoutes");
const roleCheck = require("./middleware/roleCheck");
const auth = require("./middleware/auth");
const domainRoutes = require("./routes/domainRoutes");
const telemetryRoutes = require("./routes/telemetry");
// const settingRoutes2 = require('./routes/settingRoutes');
const guestUserRoutes = require("./microservices/guestLogin/guestUser.routes");
const portfolioEditLogRoutes = require("./routes/portfolioEditLogRoutes");
const guestAdminPanelRoutes = require("./microservices/guestAdminPanel/guestAdminPanel.routes");
const portfolio_Routes = require("./routes/cleaningLady/portfolioRoutes");
const socialLinksRoutes = require("./microservices/socialLinks/socialLinks.routes");
const userPortfoliosArrayRoutes = require("./microservices/userPortfoliosArray/userPortfoliosArray.routes.js");
const publicPortfoliosRoutes = require("./microservices/publicPortfolios/publicPortfolios.routes");
const domainPaymentRouter = require("./microservices/domainPayment/stripe/stripe.route");
const emailMvpRoutes = require("./microservices/emailmvp/emailmvp.routes");
// const domainRouting = require("./middleware/domainRouting");
const googleLoginRoutes = require("./microservices/googleLogin/googleLogin.routes.js");
const contactMeRoutes = require("./microservices/contactMeForm/contactMeForm.routes.js");
const domainRouterRoutes = require("./microservices/DomainRouter/DomainRouter.routes.js")
// Import configuration from separate file
const config = require("./config");

const User = require("./models/User");

const app = express();

const PORT = process.env.PORT;
const seededOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  process.env.PUBLIC_APP_URL,
  process.env.CORS_ADDITIONAL_ORIGINS,
  "https://findvirtualme.com",
  "https://www.findvirtualme.com",
  "https://findvirtual.me",
  "https://www.findvirtual.me",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://dannizhou.me:5173",
  "https://localhost:5000",
]
  .filter(Boolean)
  .flatMap((entry) =>
    entry
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

const staticOriginSet = new Set();
const staticHostnameSet = new Set();

for (const origin of seededOrigins) {
  try {
    const url = new URL(origin);
    const normalizedOrigin = `${url.protocol}//${url.host}`.toLowerCase();
    staticOriginSet.add(normalizedOrigin);
    staticHostnameSet.add(url.hostname.toLowerCase());

    if (url.protocol === "https:") {
      staticOriginSet.add(`http://${url.host}`.toLowerCase());
    }
  } catch (error) {
    console.warn(
      `[cors] Skipping invalid configured origin "${origin}": ${error.message}`
    );
  }
}


const corsOptions = {
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true);

    let parsed;
    try {
      parsed = new URL(origin);
    } catch (error) {
      return callback(new Error("Invalid origin"));
    }

    const normalizedOrigin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    // 1. Instant check for whitelisted & previously cached domains
    if (
      hostname.endsWith("surge-ainas-projects.vercel.app") || 
      staticOriginSet.has(normalizedOrigin) || 
      staticHostnameSet.has(hostname)
    ) {
      return callback(null, true);
    }

    // 2. Dynamic check for custom domains
    try {
      const match = await User.exists({
        "domains.domain": hostname,
        "domains.status": { $in: ["active", "pending_verification", "pending"] }
      });

      if (match) {
        // Cache it for this instance's lifetime
        staticOriginSet.add(normalizedOrigin);
        staticHostnameSet.add(hostname);
        return callback(null, true);
      }

      console.warn(`[cors] Blocked: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    } catch (error) {
      console.error(`[cors] DB Error: ${error.message}`);
      // Fail safe: if DB is down, allow your main whitelist but block unknowns
      return callback(new Error("CORS validation failed"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

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

setCredentialsFromEnv();

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/health", (_req, res) => res.status(200).json({ ok: true, ts: Date.now() }));
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
app.use("/domainRouter", domainRouterRoutes)

//aiPortfolioCreator
const contactRouter = require("./microservices/aiPortfolioCreator/contact/aiPortfolioCreator.routes.js");
app.use("/api/contact", contactRouter);
const execRouter = require("./microservices/aiPortfolioCreator/exec/exec.routes.js");
app.use("/api/exec", execRouter);
const userAiPortfolioCreatorRouter = require("./microservices/aiPortfolioCreator/user/user.routes.js");
app.use("/api/user", userAiPortfolioCreatorRouter);
const projectsRouter = require("./microservices/aiPortfolioCreator/projects/projects.routes");
app.use("/api/projects", projectsRouter);
const userAciveRouter = require("./microservices/aiPortfolioCreator/setActiveProject/setActiveProject.route.js");
app.use("/api/active", userAciveRouter);
const promoRouter = require("./microservices/aiPortfolioCreator/promo/promo.routes.js");
app.use("/api/promo", promoRouter);
const userRouter = require("./microservices/aiPortfolioCreator/name/name.routes.js");
app.use("/name", userRouter);
const publicProjectsRouter = require("./microservices/aiPortfolioCreator/publicProjectsAccess/publicProjectsAccess.routes.js");
app.use("/api/publicProjects", publicProjectsRouter);
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
  express.static(path.join(__dirname, config.uploads.directory))
);
// Make config available to the app
app.set("config", config);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Back end is alive",
    timestamp: new Date().toISOString(),
  });
});

app.get("/auth-url", (req, res) => {
  // Call manually in browser
  res.send(getAuthUrl());
});

// OAuth callback (Google will redirect here after consent)
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

module.exports = app;
