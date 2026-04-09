const cors = require("cors");
const User = require("../models/User");

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
  "http://mytestdomain.local",
  "https://staging.findvirtual.me/",
]
  .filter(Boolean)
  .flatMap((entry) =>
    entry
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
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
      `[cors] Skipping invalid configured origin "${origin}": ${error.message}`,
    );
  }
}

const corsOptions = {
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Portfolio-Domain-Host",
  ],
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
    const cleanHostname = hostname.replace(/^www\./, "");

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
        "domains.domain": cleanHostname,
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

module.exports = cors(corsOptions);
