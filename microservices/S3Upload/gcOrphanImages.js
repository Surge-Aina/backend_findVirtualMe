/**
 * Daily garbage collection for S3 objects under portfolios/ that are no longer referenced
 * by any v2 portfolio document. Skips objects newer than GRACE_MS (24h).
 */
const cron = require("node-cron");
const Portfolio = require("../../models/portfolio/Portfolio");
const {
  listByPrefix,
  deleteFromS3,
  keyFromPublicUrl,
} = require("../../services/s3Service");

const PREFIX = "portfolios/";
const GRACE_MS = 24 * 60 * 60 * 1000;//24 hours before deleting orphan images

function collectReferencedKeysFromValue(val, bucket, region, outSet) {
  if (val == null) return;
  const baseNeedle = `${bucket}.s3.${region}.amazonaws.com`;
  const altNeedle = `${bucket}.s3.`;

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return;
    if (s.includes(baseNeedle) || s.includes(altNeedle)) {
      const key = keyFromPublicUrl(s);
      if (key && key.startsWith(PREFIX)) {
        outSet.add(key);
      }
    }
    return;
  }

  if (Array.isArray(val)) {
    for (const item of val) collectReferencedKeysFromValue(item, bucket, region, outSet);
    return;
  }

  if (typeof val === "object") {
    for (const v of Object.values(val)) {
      collectReferencedKeysFromValue(v, bucket, region, outSet);
    }
  }
}

async function buildReferencedKeySet() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const referenced = new Set();

  const cursor = Portfolio.find({})
    .select("navBrand sections pageBannerDefaults")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    collectReferencedKeysFromValue(doc.navBrand, bucket, region, referenced);
    collectReferencedKeysFromValue(doc.sections, bucket, region, referenced);
    collectReferencedKeysFromValue(doc.pageBannerDefaults, bucket, region, referenced);
  }

  return referenced;
}

async function runOrphanImageGc() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    console.warn("[gcOrphanImages] Missing AWS_S3_BUCKET or AWS_REGION; skipping run");
    return;
  }

  const start = Date.now();
  let deleted = 0;
  let scanned = 0;

  try {
    const referenced = await buildReferencedKeySet();
    const objects = await listByPrefix(PREFIX);
    const now = Date.now();

    for (const obj of objects) {
      scanned += 1;
      const key = obj.Key;
      if (!key) continue;

      if (referenced.has(key)) continue;

      const lm = obj.LastModified ? obj.LastModified.getTime() : 0;
      if (now - lm < GRACE_MS) continue;

      try {
        await deleteFromS3(key);
        deleted += 1;
      } catch (err) {
        console.error(`[gcOrphanImages] Failed to delete ${key}:`, err?.message || err);
      }
    }

    console.log(
      `[gcOrphanImages] Done in ${Date.now() - start}ms — scanned=${scanned}, deleted=${deleted}, referencedKeys=${referenced.size}`,
    );
  } catch (err) {
    console.error("[gcOrphanImages] Run failed:", err);
  }
}

/**
 * Schedule daily at 03:00 server local time.
 */
function startOrphanImageGcCron() {
  cron.schedule("0 3 * * *", () => {
    runOrphanImageGc();
  });
  console.log("[gcOrphanImages] Scheduled daily at 03:00 (server local time)");
}

module.exports = { runOrphanImageGc, startOrphanImageGcCron };
