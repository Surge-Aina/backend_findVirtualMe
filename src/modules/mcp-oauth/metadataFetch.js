const https = require("https");
const { createPinnedHttpsTarget } = require("../public-api/webhookUrls");

const MAX_BODY_BYTES = 32 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_MAX = 200;
const cache = new Map();

function setCache(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + 15 * 60 * 1000 });
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function fetchJsonPinned(target) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: target.hostname,
        servername: target.servername,
        port: target.port,
        method: "GET",
        path: `${target.pathname}${target.search}`,
        headers: { Accept: "application/json" },
        lookup: target.lookup,
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`metadata fetch failed with status ${res.statusCode}`));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on("data", (chunk) => {
          total += chunk.length;
          if (total > MAX_BODY_BYTES) {
            req.destroy();
            reject(new Error("client metadata exceeds size limit"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve(JSON.parse(raw));
          } catch (_err) {
            reject(new Error("client metadata is not valid JSON"));
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("client metadata fetch timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchClientMetadataDocument(clientId) {
  const cached = getCache(clientId);
  if (cached) return cached;

  const target = await createPinnedHttpsTarget(clientId);
  const body = await fetchJsonPinned(target);
  setCache(clientId, body);
  return body;
}

function clearMetadataFetchCache() {
  cache.clear();
}

module.exports = {
  fetchClientMetadataDocument,
  clearMetadataFetchCache,
  fetchJsonPinned,
};