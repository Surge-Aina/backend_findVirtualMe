const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const User = require("../../../shared/models/User");
const Portfolio = require("../../portfolios/models/Portfolio");
const DomainRoute = require("../../domains/DomainRouter/DomainRouter.model");
const WalletPassSettings = require("../walletPassSettings.model");
const WalletPassLink = require("../walletPassLink.model");
const { publicRouter, ownerRouter } = require("../walletPass.routes");
const { resetPublicApiRateLimits } = require("../rateLimit");

const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
const API_KEY = "wm_synthetic_key_zz99";
const VISITOR = "visitor.pass@example.test";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel)";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(publicRouter);
app.use("/api/portfolios", ownerRouter);

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

function sessionFor(user) {
  return `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "20m" })}`;
}

async function createUser() {
  const id = nonce();
  return User.create({
    username: `wallet_${id}`,
    email: `mailbox.wallet.${id}@example.test`,
    password: "synthetic-password",
    userKey: `uk_${id}`,
    practiceId: `pid_${id}`,
    role: "customer",
  });
}

async function createSite(owner, visibility = "public") {
  return Portfolio.create({
    owner: owner._id,
    slug: `tap${nonce()}`,
    title: "Synthetic Site",
    template: "healthcare",
    visibility,
  });
}

function customerResponse(serial) {
  return {
    ok: true,
    status: 201,
    json: async () => ({ customerId: "cus_synthetic", wallet: { serialNumber: serial } }),
  };
}

describe("wallet tap landing", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.PARTNER_CREDENTIALS_KEY = ENCRYPTION_KEY;
    process.env.PARTNER_CREDENTIALS_KEY_VERSION = "1";
    process.env.PUBLIC_SITE_HOST = "findvirtual.me";
    process.env.WALLETME_API_BASE_URL = "https://wallet.example.test";
    global.fetch = jest.fn(async () => customerResponse("serial_abc"));
    await resetPublicApiRateLimits();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function connect(user, site) {
    return request(app)
      .put(`/api/portfolios/${site._id}/wallet-pass`)
      .set("Authorization", sessionFor(user))
      .send({ groupId: "grp_demo", apiKey: API_KEY });
  }

  it("returns the NFC url and a PNG of that url for the owner", async () => {
    const user = await createUser();
    const site = await createSite(user);
    const other = await createUser();

    const before = await request(app)
      .get(`/api/portfolios/${site._id}/wallet-pass`)
      .set("Authorization", sessionFor(user));
    expect(before.body.data.url).toBe(`https://${site.slug}.findvirtual.me/wallet`);
    expect(before.body.data.configured).toBe(false);
    expect(JSON.stringify(before.body)).not.toContain(API_KEY);

    const saved = await connect(user, site);
    expect(saved.status).toBe(200);
    expect(saved.body.data.configured).toBe(true);
    expect(saved.body.data.groupId).toBe("grp_demo");
    expect(saved.body.data.secretLast4).toBe("zz99");
    expect(saved.body.data.url).toBe(`https://${site.slug}.findvirtual.me/wallet`);
    expect(JSON.stringify(saved.body)).not.toContain(API_KEY);

    const loyalty = await request(app)
      .get(`/api/portfolios/${site._id}/wallet-pass?pass=loyalty`)
      .set("Authorization", sessionFor(user));
    expect(loyalty.body.data.url).toBe(`https://${site.slug}.findvirtual.me/wallet?pass=loyalty`);

    const png = await request(app)
      .get(`/api/portfolios/${site._id}/wallet-pass/qr.png?pass=loyalty`)
      .set("Authorization", sessionFor(user))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(png.status).toBe(200);
    expect(png.headers["content-type"]).toMatch(/image\/png/);
    expect(png.headers["content-disposition"]).toContain("wallet-qr.png");
    expect(png.body.subarray(0, 4).toString("hex")).toBe("89504e47");
    const expected = await QRCode.toBuffer(loyalty.body.data.url, {
      type: "png",
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    expect(Buffer.compare(png.body, expected)).toBe(0);

    const stored = await WalletPassSettings.findOne({ siteId: site._id }).lean();
    expect(JSON.stringify(stored)).not.toContain(API_KEY);

    const denied = await request(app)
      .get(`/api/portfolios/${site._id}/wallet-pass`)
      .set("Authorization", sessionFor(other));
    expect(denied.status).toBe(404);
  });

  it("asks for an email, then opens the same add link once per visitor", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const user = await createUser();
    const site = await createSite(user);
    await connect(user, site);
    const host = `${site.slug}.findvirtual.me`;

    const first = await request(app).get("/wallet").set("Host", host).set("User-Agent", IPHONE);
    expect(first.status).toBe(200);
    expect(first.text).toContain("Enter your email");
    expect(first.headers.location).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();

    const missingConsent = await request(app)
      .post("/wallet")
      .set("Host", host)
      .type("form")
      .send({ email: VISITOR, site: site.slug, pass: "card" });
    expect(missingConsent.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();

    const phone = await request(app)
      .post("/wallet")
      .set("Host", host)
      .set("User-Agent", IPHONE)
      .type("form")
      .send({ email: VISITOR, consent: "yes", site: site.slug, pass: "loyalty" });
    expect(phone.status).toBe(302);
    expect(phone.headers.location).toBe("https://wallet.example.test/v1/wallet/add/serial_abc");
    expect(phone.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(phone.text).not.toContain(VISITOR);

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://wallet.example.test/v1/groups/grp_demo/customers");
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.redirect).toBe("error");
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ displayName: "Guest", email: VISITOR, groupId: "grp_demo" });
    expect(init.headers["Idempotency-Key"]).toMatch(/^[a-f0-9]{64}$/);
    expect(init.headers["Idempotency-Key"]).not.toContain("visitor");

    const again = await request(app)
      .post("/wallet?pass=coupon")
      .set("Host", host)
      .set("User-Agent", ANDROID)
      .type("form")
      .send({ email: `  ${VISITOR.toUpperCase()}  `, consent: "yes", pass: "coupon" });
    expect(again.status).toBe(302);
    expect(again.headers.location).toBe(phone.headers.location);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const cookie = phone.headers["set-cookie"][0].split(";")[0];
    const remembered = await request(app)
      .get("/wallet?pass=coupon")
      .set("Host", host)
      .set("User-Agent", ANDROID)
      .set("Cookie", cookie);
    expect(remembered.status).toBe(200);
    expect(remembered.text).toContain("Enter your email");

    const freshCookie = again.headers["set-cookie"][0].split(";")[0];
    const tap = await request(app)
      .get("/wallet")
      .set("Host", host)
      .set("User-Agent", ANDROID)
      .set("Cookie", freshCookie);
    expect(tap.status).toBe(302);
    expect(tap.headers.location).toBe("https://wallet.example.test/v1/wallet/add/serial_abc");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const desktop = await request(app)
      .post("/wallet")
      .set("Host", host)
      .set("User-Agent", DESKTOP)
      .type("form")
      .send({ email: VISITOR, consent: "yes", pass: "card" });
    expect(desktop.status).toBe(200);
    expect(desktop.text).toContain("Add to Apple Wallet");
    expect(desktop.text).toContain("Add to Google Wallet");
    expect(desktop.text).toContain("https://wallet.example.test/v1/wallet/add/serial_abc");
    expect(desktop.text).toContain("data:image/png;base64,");
    expect(desktop.text).not.toContain(VISITOR);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const row = await WalletPassLink.findOne({ siteId: site._id }).lean();
    expect(JSON.stringify(row)).not.toContain(VISITOR);
    expect(row.serialNumber).toBe("serial_abc");
    const logs = errorSpy.mock.calls.flat().join(" ");
    expect(logs).not.toContain(VISITOR);
    expect(logs).not.toContain(API_KEY);
    errorSpy.mockRestore();
  });

  it("reads the serial from the customer detail when create omits it", async () => {
    global.fetch = jest.fn(async (url, init) => {
      if (init && init.method === "POST") {
        return { ok: true, status: 201, json: async () => ({ customerId: "cus_detail", wallet: {} }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ customerId: "cus_detail", wallet: { serialNumber: "serial_from_detail" } }),
      };
    });
    const user = await createUser();
    const site = await createSite(user);
    await connect(user, site);
    const opened = await request(app)
      .post("/wallet")
      .set("Host", `${site.slug}.findvirtual.me`)
      .set("User-Agent", IPHONE)
      .type("form")
      .send({ email: VISITOR, consent: "yes" });
    expect(opened.status).toBe(302);
    expect(opened.headers.location).toBe("https://wallet.example.test/v1/wallet/add/serial_from_detail");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const detailUrl = global.fetch.mock.calls[1][0];
    expect(detailUrl).toBe("https://wallet.example.test/v1/customers/cus_detail");
  });

  it("does not call WalletMe or store the email when the pass cannot be created", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const user = await createUser();
    const site = await createSite(user);
    const quiet = await request(app).get("/wallet").set("Host", `${site.slug}.findvirtual.me`);
    expect(quiet.status).toBe(200);
    expect(quiet.text).toContain("not available yet");
    expect(global.fetch).not.toHaveBeenCalled();

    await connect(user, site);
    global.fetch = jest.fn(async () => {
      throw new Error(`network ${VISITOR}`);
    });
    const failed = await request(app)
      .post("/wallet")
      .set("Host", `${site.slug}.findvirtual.me`)
      .type("form")
      .send({ email: VISITOR, consent: "yes" });
    expect(failed.status).toBe(502);
    expect(failed.text).not.toContain(VISITOR);
    expect(await WalletPassLink.countDocuments({ siteId: site._id })).toBe(0);
    const logs = errorSpy.mock.calls.flat().join(" ");
    expect(logs).toContain("wallet_pass_upstream_error");
    expect(logs).not.toContain(VISITOR);
    expect(logs).not.toContain(API_KEY);
    errorSpy.mockRestore();
  });

  it("resolves a public custom domain and rejects private or foreign hosts", async () => {
    const user = await createUser();
    const site = await createSite(user);
    const hidden = await createSite(user, "private");
    await connect(user, site);
    user.domains = [
      { domain: "shop.example.test", portfolioId: site._id.toString(), status: "active", type: "byod" },
    ];
    await user.save();

    const custom = await request(app)
      .get("/wallet?pass=loyalty")
      .set("Host", "shop.example.test");
    expect(custom.status).toBe(200);
    expect(custom.text).toContain('value="loyalty"');

    const routed = await createSite(user);
    await connect(user, routed);
    await DomainRoute.create({
      domain: "route.example.test",
      userId: user._id,
      portfolioId: routed._id,
      isActive: true,
    });
    const byRoute = await request(app).get("/wallet").set("Host", "route.example.test");
    expect(byRoute.status).toBe(200);
    expect(byRoute.text).toContain("Enter your email");

    const closed = await request(app).get("/wallet").set("Host", `${hidden.slug}.findvirtual.me`);
    expect(closed.status).toBe(404);

    const foreign = await request(app).get(`/wallet?site=${site.slug}`).set("Host", "evil.example.test");
    expect(foreign.status).toBe(404);

    const query = await request(app).get(`/wallet?site=${site.slug}`).set("Host", "findvirtual.me");
    expect(query.status).toBe(200);

    const badPass = await request(app).get("/wallet?pass=Not A Pass").set("Host", `${site.slug}.findvirtual.me`);
    expect(badPass.status).toBe(400);
  });

  it("rate limits repeated claims without recording the email", async () => {
    const user = await createUser();
    const site = await createSite(user);
    await connect(user, site);
    const host = `${site.slug}.findvirtual.me`;
    let last = null;
    for (let i = 0; i < 11; i += 1) {
      last = await request(app)
        .post("/wallet")
        .set("Host", host)
        .set("User-Agent", DESKTOP)
        .type("form")
        .send({ email: VISITOR, consent: "yes" });
    }
    expect(last.status).toBe(429);
    expect(last.text).not.toContain(VISITOR);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses to store a key when credential encryption is not configured", async () => {
    delete process.env.PARTNER_CREDENTIALS_KEY;
    delete process.env.PARTNER_CREDENTIALS_KEY_V1;
    const user = await createUser();
    const site = await createSite(user);
    const saved = await connect(user, site);
    expect(saved.status).toBe(503);
    expect(await WalletPassSettings.countDocuments({ siteId: site._id })).toBe(0);
  });
});
