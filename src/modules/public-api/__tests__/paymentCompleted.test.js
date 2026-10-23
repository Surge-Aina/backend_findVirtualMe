const crypto = require("crypto");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const PlatformApp = require("../../marketplace/app.model");
const Installation = require("../../marketplace/installation.model");
const PaymentNotice = require("../paymentNotice.model");
const { createEndpoint } = require("../webhook.service");
const { signWebhookPayload } = require("../webhookSignature");
const { acceptStripeSitePayment } = require("../sitePayment");
const { forwardPaymentCompleted } = require("../paymentIngest.adapter");

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

describe("payment.completed", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    delete process.env.WALLETME_PAYMENT_INGEST_ENABLED;
    delete process.env.WALLETME_PAYMENT_INGEST_PATH;
    global.fetch = jest.fn(async () => ({ status: 200, text: async () => "" }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("signs one site payment and does not call an unpublished ingest API", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const user = await User.create({
      username: `pay_${nonce()}`,
      email: `mailbox.pay.${nonce()}@example.test`,
      password: "synthetic-password",
      userKey: `uk_${nonce()}`,
      practiceId: `pid_${nonce()}`,
      role: "customer",
    });
    const site = await Portfolio.create({
      owner: user._id,
      slug: `pay${nonce()}`,
      title: "Synthetic Site",
      template: "healthcare",
      visibility: "public",
    });
    const hook = await createEndpoint({
      userId: user._id,
      url: "https://hooks.example.test/payments",
      events: ["payment.completed"],
    });

    const payerEmail = "payer@example.test";
    const first = await acceptStripeSitePayment({
      kind: "payment_intent",
      object: {
        id: "pi_synthetic_completed",
        status: "succeeded",
        amount: 2500,
        currency: "usd",
        created: 1760000000,
        receipt_email: payerEmail,
        metadata: { siteId: site._id.toString(), phone: "+1-555-010-0000" },
      },
    });
    expect(first.emitted).toBe(true);
    expect(first.event.type).toBe("payment.completed");
    expect(first.event.data.amount).toBe(2500);
    expect(first.event.data.currency).toBe("usd");
    expect(first.event.data.email).toBe(payerEmail);
    expect(first.event.data.occurredAt).toBe("2025-10-09T08:53:20.000Z");
    expect(first.event.data.idempotencyKey).toBe("stripe:pi_synthetic_completed");

    const call = global.fetch.mock.calls.find((item) => item[0] === "https://hooks.example.test/payments");
    const timestamp = call[1].headers["X-FindVirtualMe-Timestamp"];
    expect(call[1].headers["X-FindVirtualMe-Signature"]).toBe(
      `v1=${signWebhookPayload(hook.secret, timestamp, call[1].body)}`
    );
    const stored = await PaymentNotice.findOne({ idempotencyKey: "stripe:pi_synthetic_completed" }).lean();
    expect(JSON.stringify(stored)).not.toContain(payerEmail);

    const again = await acceptStripeSitePayment({
      kind: "checkout_session",
      object: {
        id: "cs_synthetic_completed",
        payment_status: "paid",
        amount_total: 2500,
        currency: "USD",
        payment_intent: "pi_synthetic_completed",
        customer_details: { email: payerEmail, phone: "+1-555-010-0000" },
        metadata: { siteId: site._id.toString() },
      },
    });
    expect(again.duplicate).toBe(true);
    expect(global.fetch.mock.calls.filter((item) => item[0] === "https://hooks.example.test/payments")).toHaveLength(1);

    const platform = await acceptStripeSitePayment({
      kind: "payment_intent",
      object: {
        id: "pi_subscription_only",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        description: "Subscription update",
        metadata: {},
      },
    });
    expect(platform.emitted).toBe(false);

    const app = await PlatformApp.create({
      ownerId: user._id,
      name: "WalletMe",
      slug: "walletme",
      clientId: `fvm_app_${nonce()}`,
      clientSecretHash: "synthetic-hash",
      secretLast4: "hash",
      redirectUris: ["https://hooks.example.test/callback"],
      scopes: ["sites:read"],
      reviewStatus: "approved",
    });
    await Installation.create({
      appId: app._id,
      userId: user._id,
      siteId: site._id,
      scopes: ["sites:read"],
      status: "installed",
    });
    const disabled = await forwardPaymentCompleted(first.event);
    expect(disabled).toEqual({ forwarded: false, reason: "disabled" });
    process.env.WALLETME_PAYMENT_INGEST_ENABLED = "true";
    const unpublished = await forwardPaymentCompleted(first.event);
    expect(unpublished).toEqual({ forwarded: false, reason: "endpoint_unpublished" });
    expect(global.fetch.mock.calls.every((item) => item[0] === "https://hooks.example.test/payments")).toBe(true);
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(payerEmail);
    errorSpy.mockRestore();
  });
});
