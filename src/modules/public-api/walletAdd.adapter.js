const { assertPublicHttpsUrl } = require("./webhookUrls");

const DEFAULT_BASE = "https://sandbox-api.walletmeinc.com";
const SERIAL_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function apiOrigin() {
  const raw = (process.env.WALLETME_API_BASE_URL || DEFAULT_BASE).trim();
  const normalized = assertPublicHttpsUrl(raw);
  return new URL(normalized).origin;
}

function readSerial(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const nested = body.wallet && typeof body.wallet === "object" ? body.wallet.serialNumber : "";
  const candidates = [nested, body.serialNumber];
  for (const value of candidates) {
    if (typeof value === "string" && SERIAL_RE.test(value)) return value;
  }
  return "";
}

function readCustomerId(body) {
  if (!body || typeof body !== "object") return "";
  const value = body.customerId || body.id;
  return typeof value === "string" && ID_RE.test(value) ? value : "";
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

async function walletFetch(url, options) {
  return fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}

/**
 * Creates a WalletMe customer and returns the public add URL for that serial.
 * POST /v1/groups/{groupId}/customers, then GET /v1/wallet/add/{serialNumber}.
 * The shared NFC tag must not point at the add URL. That URL is one visitor.
 */
async function createVisitorPass({ apiKey, groupId, email, idempotencyKey }) {
  let origin;
  try {
    origin = apiOrigin();
  } catch (_err) {
    console.error("wallet_pass_base_url_rejected");
    return { ok: false, reason: "misconfigured" };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };

  try {
    const created = await walletFetch(
      `${origin}/v1/groups/${encodeURIComponent(groupId)}/customers`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Guest",
          email,
          groupId,
        }),
      }
    );
    if (!created.ok) {
      console.error("wallet_pass_upstream_error");
      return { ok: false, reason: "upstream_error" };
    }
    const createdBody = await readJson(created);
    let serial = readSerial(createdBody);
    if (!serial) {
      const customerId = readCustomerId(createdBody);
      if (!customerId) {
        console.error("wallet_pass_serial_missing");
        return { ok: false, reason: "serial_missing" };
      }
      const detail = await walletFetch(`${origin}/v1/customers/${encodeURIComponent(customerId)}`, {
        method: "GET",
        headers,
      });
      if (!detail.ok) {
        console.error("wallet_pass_upstream_error");
        return { ok: false, reason: "upstream_error" };
      }
      serial = readSerial(await readJson(detail));
    }
    if (!serial) {
      console.error("wallet_pass_serial_missing");
      return { ok: false, reason: "serial_missing" };
    }
    return {
      ok: true,
      serialNumber: serial,
      addUrl: `${origin}/v1/wallet/add/${encodeURIComponent(serial)}`,
    };
  } catch (_err) {
    console.error("wallet_pass_upstream_error");
    return { ok: false, reason: "upstream_error" };
  }
}

function addUrlForSerial(serialNumber) {
  if (!SERIAL_RE.test(serialNumber)) return "";
  try {
    return `${apiOrigin()}/v1/wallet/add/${encodeURIComponent(serialNumber)}`;
  } catch (_err) {
    console.error("wallet_pass_base_url_rejected");
    return "";
  }
}

module.exports = {
  createVisitorPass,
  addUrlForSerial,
  apiOrigin,
};
