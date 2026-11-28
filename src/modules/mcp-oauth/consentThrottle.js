const buckets = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function touch(key) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_PER_WINDOW) {
    const err = new Error("Too many consent attempts. Try again later.");
    err.code = "rate_limited";
    err.status = 429;
    throw err;
  }
}

function throttleConsentByIp(ip) {
  const key = `ip:${ip || "unknown"}`;
  touch(key);
}

function throttleConsentByAccount(accountKey) {
  if (!accountKey) return;
  const key = `acct:${String(accountKey).trim().toLowerCase()}`;
  touch(key);
}

function resetConsentThrottles() {
  buckets.clear();
}

module.exports = {
  throttleConsentByIp,
  throttleConsentByAccount,
  resetConsentThrottles,
};