const dns = require("dns").promises;
const https = require("https");
const { URL } = require("url");

const MAX_BODY_BYTES = 32 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_MAX = 200;
const cache = new Map();

function isPrivateOrLocalIp(address) {
  if (!address) return true;
  const normalized = address.toLowerCase();
  if (normalized.includes(":")) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80:")) return true;
    return false;
  }
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 0) return true;
  return false;
}

async function assertPublicHost(url) {
  if (url.protocol !== "https:") {
    throw new Error("client metadata must use https");
  }
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    throw new Error("client metadata host is not allowed");
  }
  const { address } = await dns.lookup(host, { verbatim: true });
  if (isPrivateOrLocalIp(address)) {
    throw new Error("client metadata host resolves to a private address");
  }
}

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { timeout: FETCH_TIMEOUT_MS, headers: { Accept: "application/json" } },
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
  });
}

async function fetchClientMetadataDocument(clientId) {
  const cached = getCache(clientId);
  if (cached) return cached;

  const url = new URL(clientId);
  await assertPublicHost(url);
  const body = await fetchJson(url);
  setCache(clientId, body);
  return body;
}

function clearMetadataFetchCache() {
  cache.clear();
}

module.exports = {
  fetchClientMetadataDocument,
  clearMetadataFetchCache,
  isPrivateOrLocalIp,
};