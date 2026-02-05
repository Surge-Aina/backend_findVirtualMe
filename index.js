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
const userRoutes = require("./routes/userRoute");
const projectManagerPortfolioRoutes = require("./routes/projectManager/portfolioRoute");
// const uploadRoutes = require("./routes/photographer/uploadRoute");
const checkoutRoutes = require("./routes/stripePayment/checkoutRoutes");
const authRoutes = require("./routes/auth"); // Import authentication routes
const seedUsers = require("./seed/users"); // Import seed users function
const domainResolver = require("./middleware/domainResolver"); // Import domain resolver
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
const socialLinksRoutes = require("./microservices/socialLinks/socialLinks.routes");
//const userPortfoliosArrayRoutes = require("./microservices/userPortfoliosArray/userPortfoliosArray.routes.js");
//const publicPortfoliosRoutes = require("./microservices/publicPortfolios/publicPortfolios.routes");
const domainPaymentRouter = require("./microservices/domainPayment/stripe/stripe.route");
const emailMvpRoutes = require("./microservices/emailmvp/emailmvp.routes");
const domainRouting = require("./middleware/domainRouting");
const googleLoginRoutes = require("./microservices/googleLogin/googleLogin.routes.js");
const contactMeRoutes = require("./microservices/contactMeForm/contactMeForm.routes.js");

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
  "https://frontend-find-virtual-me-staging.vercel.app",
  "https://staging.findvirtual.me",
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
  origin: seededOrigins,
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    let parsed;
    try {
      parsed = new URL(origin);
    } catch (error) {
      console.warn(`[cors] Rejecting malformed origin "${origin}"`);
      return callback(new Error("Invalid origin"));
    }

    const normalizedOrigin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.endsWith("surge-ainas-projects.vercel.app")) {
      return callback(null, true);
    }

    if (staticOriginSet.has(normalizedOrigin) || staticHostnameSet.has(hostname)) {
      return callback(null, true);
    }

    User.exists({
      "domains.domain": hostname,
      "domains.status": "active",
    })
      .then((match) => {
        if (match) {
          staticOriginSet.add(normalizedOrigin);
          staticHostnameSet.add(hostname);
          return callback(null, true);
        }

        console.warn(
          `[cors] Blocked origin "${origin}" (no matching active domain)`
        );
        return callback(new Error("Not allowed by CORS"));
      })
      .catch((error) => {
        console.error(
          `[cors] Failed checking origin "${origin}": ${error.message}`
        );
        return callback(new Error("Not allowed by CORS"));
      });
  },
  credentials: true,
  // allowedHeaders: [
  //   "Content-Type",
  //   "Authorization",
  //   "Cross-Origin-Embedder-Policy",
  //   "Cross-Origin-Opener-Policy",
  // ],
};

app.use(cors(corsOptions));
//app.use(cors());

//needed for webContainers
// app.use((req, res, next) => {
//   res.set({
//     "Cross-Origin-Opener-Policy": "same-origin",
//     "Cross-Origin-Embedder-Policy": "require-corp",
//     "Cross-Origin-Resource-Policy": "same-origin",
//   });
//   next();
// });

app.set("trust proxy", true);

//stripe webhook(must be before app.use(express.json()))
//do not call directly, stripe will call this route
app.use("/stripe-webhook", stripeWebhookRoutes);

app.use(express.json({ limit: "1mb" }));

// Domain resolver middleware - must be before other routes
// app.use(domainResolver);
// app.use("/api/portfolios", portfolio_Routes);
app.use(domainRouting);
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

// Mount the software engineering portfolio API routes at /softwareeng
//app.use("/softwareeng", softwareEngRoutes);

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

//onboarding
// app.use("/onboarding", onboardingRoutes);

app.use("/user", userRoutes); //onboarding now routes here
//app.use("/upload", uploadRoutes);
app.use("/support-form", supportFormRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/portfolio-edit-log", portfolioEditLogRoutes);

// app.use("/cleaning/user", userRoutes2);
// app.use('/services', serviceRoutes);
// app.use('/quotes', quoteRoutes);
// app.use('/rooms', roomRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);
app.use("/healthcare", healthcareRoutes);
app.use("/api/telemetry", telemetryRoutes);

//microservices
app.use("/guestUser", guestUserRoutes);
app.use("/guestAdminPanel", guestAdminPanelRoutes);
app.use("/social-links", socialLinksRoutes);
//app.use("/userPortfoliosArray", userPortfoliosArrayRoutes);
//app.use("/publicPortfolios", publicPortfoliosRoutes);
app.use("/api/domainPayment", domainPaymentRouter);
app.use("/google-login/", googleLoginRoutes);
app.use("/contactMe", contactMeRoutes);

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

/**
 * Connect to MongoDB using the connection function from utils/db.js
 * @function
 * @returns {Promise<void>} Logs success or error to console
 * @notes Uses centralized database connection. Connection is required for API to function.
 */
// connectDB()
//   .then(async () => {
//     // Seed users after successful database connection
//     await seedUsers();
//   })
//   .catch((err) => console.error(err)); // Log connection errors

// /**
//  * Mount the authentication API routes at /auth
//  * @function
//  * @param {string} path - The base path for the routes
//  * @param {Router} router - The Express router for authentication APIs
//  */
// app.use("/auth", authRoutes);

// /**
//  * Serve static files from uploads directory
//  * @function
//  * @param {string} path - The URL path to serve files from
//  * @param {Function} middleware - Express static middleware
//  */
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve static files from uploads directory
app.use(
  `/${config.uploads.directory}`,
  express.static(path.join(__dirname, config.uploads.directory))
);
// app.use('/api/settings', settingRoutes2);
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

/**
 * Start the Express server on the specified port
 * @function
 * @param {number} PORT - The port number to listen on
 * @returns {void}
 */

// Only start the server if this file is run directly (not imported for testing)
// if (require.main === module) {
//   server.listen(PORT, () => console.log(`✅ Server running on PORT: ${PORT}`));
// }

module.exports = app;
