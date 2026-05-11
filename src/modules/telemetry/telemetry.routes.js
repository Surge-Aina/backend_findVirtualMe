const express = require("express");
const router = express.Router();
const geoip = require("geoip-lite");
const LocationPing = require("../../shared/models/LocationPing");

const fetch =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const USE_FALLBACK = false;

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return (req.socket?.remoteAddress || "").replace("::ffff:", "").trim();
}

async function lookupCityFallback(ip, base) {
  if (!USE_FALLBACK) return base;
  if (base?.city && base.city !== "Unknown") return base;

  try {
    const resp = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`,
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

router.post("/visit", async (req, res) => {
  try {
    const ip = getClientIp(req);

    const g = ip ? geoip.lookup(ip) : null;
    let geo = {
      city: g?.city || "Unknown",
      region: g?.region || "Unknown",
      country: g?.country || "Unknown",
    };

    geo = await lookupCityFallback(ip, geo);

    const doc = await LocationPing.create({
      userId: req.user?._id || null,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      page: req.body?.page || req.path,
      ts: new Date(),
    });

    return res.status(201).json({
      message: "Telemetry stored",
      city: doc.city,
      region: doc.region,
      country: doc.country,
      page: doc.page,
      ts: doc.ts,
    });
  } catch (e) {
    console.error("[telemetry] visit error:", e);
    return res.status(500).json({ error: "server error" });
  }
});

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
