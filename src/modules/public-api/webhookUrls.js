const dns = require("dns");
const https = require("https");
const net = require("net");

const blockList = new net.BlockList();
blockList.addSubnet("0.0.0.0", 8, "ipv4");
blockList.addSubnet("10.0.0.0", 8, "ipv4");
blockList.addSubnet("100.64.0.0", 10, "ipv4");
blockList.addSubnet("127.0.0.0", 8, "ipv4");
blockList.addSubnet("169.254.0.0", 16, "ipv4");
blockList.addSubnet("172.16.0.0", 12, "ipv4");
blockList.addSubnet("192.0.0.0", 24, "ipv4");
blockList.addSubnet("192.0.2.0", 24, "ipv4");
blockList.addSubnet("192.168.0.0", 16, "ipv4");
blockList.addSubnet("198.18.0.0", 15, "ipv4");
blockList.addSubnet("198.51.100.0", 24, "ipv4");
blockList.addSubnet("203.0.113.0", 24, "ipv4");
blockList.addSubnet("224.0.0.0", 4, "ipv4");
blockList.addAddress("::", "ipv6");
blockList.addAddress("::1", "ipv6");
blockList.addSubnet("fc00::", 7, "ipv6");
blockList.addSubnet("fe80::", 10, "ipv6");
blockList.addSubnet("fec0::", 10, "ipv6");
blockList.addSubnet("ff00::", 8, "ipv6");
blockList.addSubnet("100::", 64, "ipv6");

let transportOverride = null;

function blocked(message) {
  const err = new Error(message || "url host is not allowed");
  err.code = "ssrf_blocked";
  err.field = "url";
  return err;
}

function bareHost(hostname) {
  let host = String(hostname || "").trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  host = host.replace(/\.+$/, "");
  const zone = host.indexOf("%");
  if (zone !== -1) host = host.slice(0, zone);
  return host;
}

function isBlockedHostname(host) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".localdomain") || host.endsWith(".internal")) {
    return true;
  }
  return false;
}

function hextetsToIpv4(high, low) {
  const left = Number.parseInt(high, 16);
  const right = Number.parseInt(low, 16);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return [(left >> 8) & 255, left & 255, (right >> 8) & 255, right & 255].join(".");
}

function expandIpv6(address) {
  const lower = bareHost(address);
  if (!lower.includes(":") && !lower.includes(".")) return null;
  const halves = lower.split("::");
  if (halves.length > 2) return null;

  function pushPart(part, into) {
    if (!part) return true;
    if (part.includes(".")) {
      if (net.isIP(part) !== 4) return false;
      const [a, b, c, d] = part.split(".").map((item) => Number(item));
      into.push(((a << 8) | b).toString(16));
      into.push(((c << 8) | d).toString(16));
      return true;
    }
    if (!/^[0-9a-f]{1,4}$/.test(part)) return false;
    into.push(part);
    return true;
  }

  const left = [];
  const right = [];
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  for (const part of head) {
    if (!pushPart(part, left)) return null;
  }
  for (const part of tail) {
    if (!pushPart(part, right)) return null;
  }
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    return left.map((item) => item.padStart(4, "0"));
  }
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill("0"), ...right].map((item) => item.padStart(4, "0"));
}

function isBlockedIpv4(address) {
  if (net.isIP(address) !== 4) return false;
  return blockList.check(address, "ipv4");
}

function embeddedPrivateIpv4(address) {
  const hextets = expandIpv6(address);
  if (!hextets) return false;
  if (hextets[0] === "2002") {
    const v4 = hextetsToIpv4(hextets[1], hextets[2]);
    if (v4 && isBlockedIpv4(v4)) return true;
  }
  const nat64 =
    hextets[0] === "0064" &&
    hextets[1] === "ff9b" &&
    hextets[2] === "0000" &&
    hextets[3] === "0000" &&
    hextets[4] === "0000" &&
    hextets[5] === "0000";
  const nat64Local = hextets[0] === "0064" && hextets[1] === "ff9b" && hextets[2] === "0001";
  if (nat64 || nat64Local) {
    const v4 = hextetsToIpv4(hextets[6], hextets[7]);
    if (v4 && isBlockedIpv4(v4)) return true;
  }
  return false;
}

function isBlockedIp(address) {
  const host = bareHost(address);
  const version = net.isIP(host);
  if (version === 4) return isBlockedIpv4(host);
  if (version === 6) {
    if (blockList.check(host, "ipv6")) return true;
    return embeddedPrivateIpv4(host);
  }
  return false;
}

function isPrivateIp(address) {
  return isBlockedIp(address);
}

function assertPublicHttpsUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500 || /[\u0000-\u0020\\#]/.test(raw)) {
    throw blocked(raw && raw.length > 500 ? "url is too long" : "url must be an https URL");
  }
  let url;
  try {
    url = new URL(raw);
  } catch (_err) {
    throw blocked("url must be an https URL");
  }
  if (url.protocol !== "https:") throw blocked("url must use https");
  if (url.username || url.password) throw blocked("url must not include credentials");
  if (url.hash) throw blocked("url host is not allowed");
  const host = bareHost(url.hostname);
  if (isBlockedHostname(host) || (net.isIP(host) && isBlockedIp(host))) {
    throw blocked("url host is not allowed");
  }
  return url.toString();
}

function lookupAll(hostname) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(blocked("url host is not allowed")), 5000);
    dns.promises
      .lookup(hostname, { all: true, verbatim: true })
      .then((records) => finish(null, records))
      .catch((err) => finish(err));
  });
}

async function resolvePublicAddresses(hostname) {
  const host = bareHost(hostname);
  if (isBlockedHostname(host)) throw blocked("url host is not allowed");
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw blocked("url host is not allowed");
    return [{ address: host, family: net.isIP(host) }];
  }
  let records;
  try {
    records = await lookupAll(host);
  } catch (err) {
    if (err && err.code === "ssrf_blocked") throw err;
    throw blocked("url host is not allowed");
  }
  if (!Array.isArray(records) || records.length === 0) throw blocked("url host is not allowed");
  for (const record of records) {
    if (!record || isBlockedIp(record.address)) throw blocked("url host is not allowed");
  }
  return records;
}

function pinnedLookup(records) {
  const list = records.map((record) => ({ address: record.address, family: record.family }));
  return function lookup(_hostname, options, callback) {
    if (options && options.all) {
      callback(null, list);
      return;
    }
    const family = options && options.family;
    const chosen = list.find((item) => !family || item.family === family);
    if (!chosen) {
      const err = new Error("no address");
      err.code = "ENOTFOUND";
      callback(err);
      return;
    }
    callback(null, chosen.address, chosen.family);
  };
}

function httpsPost(target, { headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: target.hostname,
        port: target.port,
        method: "POST",
        path: `${target.pathname}${target.search}`,
        headers,
        lookup: target.lookup,
        servername: target.servername,
        timeout: 10000,
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode || 0 });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

async function postWebhook(rawUrl, init) {
  const safeUrl = assertPublicHttpsUrl(rawUrl);
  if (transportOverride) return transportOverride(safeUrl, init);
  const url = new URL(safeUrl);
  const records = await resolvePublicAddresses(url.hostname);
  return httpsPost(
    {
      hostname: bareHost(url.hostname),
      servername: bareHost(url.hostname),
      port: url.port || 443,
      pathname: url.pathname,
      search: url.search,
      lookup: pinnedLookup(records),
    },
    init
  );
}

function setWebhookTransport(fn) {
  transportOverride = typeof fn === "function" ? fn : null;
}

function resetWebhookTransport() {
  transportOverride = null;
}

module.exports = {
  assertPublicHttpsUrl,
  isBlockedIp,
  isPrivateIp,
  postWebhook,
  resolvePublicAddresses,
  setWebhookTransport,
  resetWebhookTransport,
};
