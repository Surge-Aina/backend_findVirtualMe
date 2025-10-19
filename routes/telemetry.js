const express = require("express");
const router = express.Router();
const geoip = require("geoip-lite");
const LocationPing = require("../models/LocationPing");

// In Node.js 18+, fetch is available globally; if not, dynamically import node-fetch on demand.
const fetch =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const USE_FALLBACK = false; //process.env.NODE_ENV !== "production";  // Use the online fallback only in non-production environments.
// it‘s better that it is changed to false
//const USE_FALLBACK = false

// Get client IP address (supports reverse proxy)
function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"]; // format example: "1.2.3.4, 5.6.7.8"
  if (xf) return xf.split(",")[0].trim();
  return (req.socket?.remoteAddress || "").replace("::ffff:", "").trim(); // remove IPv6 prefix by 'replace' method
}

// When geoip-lite cannot resolve a city, try a free fallback API (mainly for dev/testing) 当 geoip-lite 没有城市时，用免费 API 兜底（开发/测试时更好调试）
async function lookupCityFallback(ip, base) {
  if (!USE_FALLBACK) return base;
  if (base?.city && base.city !== "Unknown") return base;

  try {
    const resp = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`
    );
    const data = await resp.json();
    if (data?.status === "success") {
      return {
        country: data.country || base.country || "Unknown",
        region: data.regionName || base.region || "Unknown",
        city: data.city || base.city || "Unknown",
      };
    }
  } catch (e) {
    console.warn("[telemetry] fallback ip-api failed:", e?.message);
  }
  return base;
}

// Called by FE only when cookie_consent = accepted.
router.post("/visit", async (req, res) => {
  try {
    const ip = getClientIp(req);

    // 1) 本地库查询 Lookup via local geoip-lite database
    const g = ip ? geoip.lookup(ip) : null;
    let geo = {
      city: g?.city || "Unknown",
      region: g?.region || "Unknown",
      country: g?.country || "Unknown",
    };

    // 2) API Optional fallback: only in dev/test environments if city is still "Unknown"
    geo = await lookupCityFallback(ip, geo);

    // Insert into DB (schema supports anonymous userId)
    const doc = await LocationPing.create({
      userId: req.user?._id || null, // 若有鉴权中间件则写入，否则为 null. if have auth middleware, otherwise null
      city: geo.city,
      region: geo.region,
      country: geo.country,
      page: req.body?.page || req.path,
      ts: new Date(),
    });

    // Debug-friendly: return 201 with JSON
    return res.status(201).json({
      message: "Telemetry stored",
      city: doc.city,
      region: doc.region,
      country: doc.country,
      page: doc.page,
      ts: doc.ts,
      // Note: in production, I may return 204 with no body
    });
  } catch (e) {
    console.error("[telemetry] visit error:", e);
    return res.status(500).json({ error: "server error" });
  }
});

// Stats: top 10 cities in the last 7 days
router.get("/stats/city-7d", async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await LocationPing.aggregate([
      { $match: { ts: { $gte: since } } },
      { $group: { _id: { city: "$city", country: "$country" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, city: "$_id.city", country: "$_id.country", count: 1 } },
    ]);
    res.json(rows);
  } catch (e) {
    console.error("[telemetry] stats error:", e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
