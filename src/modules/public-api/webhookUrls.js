const net = require("net");

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
    return false;
  }
  return false;
}

function assertPublicHttpsUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (_err) {
    const err = new Error("url must be an https URL");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  if (url.protocol !== "https:") {
    const err = new Error("url must use https");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  if (url.username || url.password) {
    const err = new Error("url must not include credentials");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    const err = new Error("url host is not allowed");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    const err = new Error("url host is not allowed");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  if (raw.length > 500) {
    const err = new Error("url is too long");
    err.code = "validation_error";
    err.field = "url";
    throw err;
  }
  return url.toString();
}

module.exports = { assertPublicHttpsUrl, isPrivateIp };
