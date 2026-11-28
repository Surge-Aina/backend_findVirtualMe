const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../../../shared/models/User");
const authHttpRoutes = require("../../auth.http.routes");
const {
  setTwilioFactoryForTests,
  resetTwilioFactoryForTests,
} = require("../twilioVerify.service");
const { resetDailyOtpCountersForTests } = require("../phoneOtpDailyCap");
const { resetPumpGuardsForTests } = require("../phoneOtpPumpGuard");
const { phoneLookupHash, encryptPhone } = require("../phoneCrypto");
const {
  deleteRateBucketsByPrefix,
  setRateBucketNowForTests,
} = require("../../../../shared/middleware/rateBucket");

const TEST_CODE = "123456";

const PHONES = {
  US: "+14155552671",
  GB: "+442071838750",
  IN: "+919876543210",
  CA: "+12045550123",
  GG: "+447781112233",
  FR: "+33601020304",
};

const ENV_KEYS = [
  "PHONE_LOGIN_ENABLED",
  "PHONE_ENC_KEY",
  "PHONE_HASH_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_VERIFY_SERVICE_SID",
  "OTP_DAILY_CAP",
  "PHONE_LOGIN_COUNTRIES",
  "PHONE_OTP_COUNTRY_HOURLY_CAP",
  "PHONE_OTP_COUNTRY_HOURLY_CAP_IN",
  "PHONE_OTP_COUNTRY_DAILY_CAP",
  "PHONE_OTP_COUNTRY_DAILY_CAP_IN",
  "PHONE_OTP_PUMP_DISTINCT_MAX",
  "PHONE_OTP_PUMP_WINDOW_MS",
];

function saveEnv() {
  const saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  return saved;
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function enablePhoneLoginEnv() {
  process.env.PHONE_LOGIN_ENABLED = "true";
  process.env.PHONE_ENC_KEY = crypto.randomBytes(32).toString("base64");
  process.env.PHONE_HASH_KEY = crypto.randomBytes(32).toString("base64");
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_API_KEY_SID = "SK_test";
  process.env.TWILIO_API_KEY_SECRET = "secret";
  process.env.TWILIO_VERIFY_SERVICE_SID = "VA_test";
  process.env.OTP_DAILY_CAP = "200";
  delete process.env.PHONE_LOGIN_COUNTRIES;
}

function mockTwilio() {
  const verificationsCreate = jest.fn().mockResolvedValue({ status: "pending" });
  const verificationChecksCreate = jest.fn().mockResolvedValue({ status: "approved" });
  setTwilioFactoryForTests(() => ({
    verify: {
      v2: {
        services: () => ({
          verifications: { create: verificationsCreate },
          verificationChecks: { create: verificationChecksCreate },
        }),
      },
    },
  }));
  return { verificationsCreate, verificationChecksCreate };
}

const uniqueKey = () => `key_${Date.now()}_${Math.random()}`;
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;

const RATE_PREFIXES = [
  "phone_otp_send_phone_min",
  "phone_otp_send_phone_hour",
  "phone_otp_send_ip_hour",
  "phone_otp_send_country_hour",
  "phone_otp_send_country_day",
];

async function resetRateBuckets() {
  for (const prefix of RATE_PREFIXES) {
    await deleteRateBucketsByPrefix(prefix);
  }
}

describe("phone OTP international hardening", () => {
  let app;
  let customer;
  let customerToken;
  let savedEnv;

  beforeEach(async () => {
    savedEnv = saveEnv();
    enablePhoneLoginEnv();
    app = express();
    app.use(express.json());
    app.use("/api/auth", authHttpRoutes);

    await resetDailyOtpCountersForTests();
    await resetPumpGuardsForTests();
    await resetRateBuckets();
    setRateBucketNowForTests(1_700_000_000_000);

    const password = await bcrypt.hash("password123", 4);
    customer = await User.create({
      username: `cust-${Date.now()}`,
      email: `cust-${Date.now()}@example.test`,
      userKey: uniqueKey(),
      practiceId: uniquePracticeId(),
      password,
      authProvider: "local",
      role: "customer",
    });
    customerToken = jwt.sign(
      { id: customer._id, role: customer.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    mockTwilio();
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    setRateBucketNowForTests(null);
    resetTwilioFactoryForTests();
  });

  it("returns empty countries when the feature flag is off", async () => {
    process.env.PHONE_LOGIN_ENABLED = "false";
    const res = await request(app).get("/api/auth/phone/countries");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ countries: [] });
  });

  it("exposes the configured allowlist for the country picker", async () => {
    process.env.PHONE_LOGIN_COUNTRIES = "US,GB,IN";
    const res = await request(app).get("/api/auth/phone/countries");
    expect(res.status).toBe(200);
    expect(res.body.countries).toEqual(["GB", "IN", "US"]);
  });

  it("accepts US, GB, and IN numbers on start-verify", async () => {
    for (const phone of [PHONES.US, PHONES.GB, PHONES.IN]) {
      await resetRateBuckets();
      await resetDailyOtpCountersForTests();
      const res = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone });
      expect(res.status).toBe(200);
    }
  });

  it("rejects CA, GG, FR, and bare national numbers without a country", async () => {
    for (const phone of [PHONES.CA, PHONES.GG, PHONES.FR]) {
      const res = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PHONE_COUNTRY_NOT_SUPPORTED");
    }

    const bare = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: "4155552671" });
    expect(bare.status).toBe(400);
    expect(bare.body.message).toBe("Invalid request");
    expect(bare.body.code).toBeUndefined();
  });

  it("enforces per-country daily send caps", async () => {
    process.env.PHONE_OTP_COUNTRY_DAILY_CAP_IN = "1";
    await resetRateBuckets();

    const first = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: PHONES.IN });

    const second = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: "+919876543211" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("enforces per-country hourly send caps", async () => {
    process.env.PHONE_OTP_COUNTRY_HOURLY_CAP_IN = "1";
    await resetRateBuckets();

    const first = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: PHONES.IN });

    const second = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: "+919876543211" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("blocks SMS pumping bursts on a shared prefix from one IP", async () => {
    process.env.PHONE_OTP_PUMP_DISTINCT_MAX = "3";
    process.env.PHONE_OTP_PUMP_WINDOW_MS = String(15 * 60 * 1000);
    await resetPumpGuardsForTests();
    await resetRateBuckets();
    await resetDailyOtpCountersForTests();

    const base = "+1415555";
    const suffixes = ["2671", "2672", "2673", "2674"];
    const results = [];
    for (const suffix of suffixes) {
      const res = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: `${base}${suffix}` });
      results.push(res.status);
      await resetRateBuckets();
    }

    expect(results.filter((s) => s === 200).length).toBe(3);
    expect(results[3]).toBe(429);
  });

  it("rate limits rapid resends for the same phone deterministically", async () => {
    setRateBucketNowForTests(1_800_000_000_000);

    const first = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: PHONES.US });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/phone/start-verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ phone: PHONES.US });
    expect(second.status).toBe(429);
  });
});