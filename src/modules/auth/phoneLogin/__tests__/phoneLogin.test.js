const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../../../../shared/models/User");
const authHttpRoutes = require("../../auth.http.routes");
const {
  setTwilioFactoryForTests,
  resetTwilioFactoryForTests,
} = require("../twilioVerify.service");
const { resetDailyOtpCountersForTests } = require("../phoneOtpDailyCap");
const { resetLockoutsForTests } = require("../phoneOtpLockout");
const { phoneLookupHash, encryptPhone } = require("../phoneCrypto");
const { deleteRateBucketsByPrefix } = require("../../../../shared/middleware/rateBucket");
const { LOGIN_START_MESSAGE } = require("../phoneLogin.service");

const TEST_PHONE = "+14155552671";
const CUSTOMER_VERIFY_PHONE = "+14155558989";
const TEST_CODE = "123456";

const ENV_KEYS = [
  "PHONE_LOGIN_ENABLED",
  "PHONE_ENC_KEY",
  "PHONE_HASH_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_VERIFY_SERVICE_SID",
  "OTP_DAILY_CAP",
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
}

function mockTwilio({ approve = true } = {}) {
  const verificationsCreate = jest.fn().mockResolvedValue({ status: "pending" });
  const verificationChecksCreate = jest.fn().mockResolvedValue({
    status: approve ? "approved" : "pending",
  });
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

describe("phone OTP auth", () => {
  let app;
  let customer;
  let adminUser;
  let customerToken;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/auth", authHttpRoutes);

    await resetDailyOtpCountersForTests();
    await resetLockoutsForTests();
    await deleteRateBucketsByPrefix("phone_otp_send");
    await deleteRateBucketsByPrefix("phone_otp_verify");

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
    adminUser = null;
    customerToken = jwt.sign(
      { id: customer._id, role: customer.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  afterEach(() => {
    resetTwilioFactoryForTests();
  });

  it("returns 404 for phone routes when the feature flag is off", async () => {
    const saved = saveEnv();
    delete process.env.PHONE_LOGIN_ENABLED;
    delete process.env.PHONE_ENC_KEY;
    delete process.env.PHONE_HASH_KEY;

    const res = await request(app)
      .post("/api/auth/phone/login/start")
      .send({ phone: TEST_PHONE });

    expect(res.status).toBe(404);
    restoreEnv(saved);
  });

  it("disables itself when encryption keys are missing", async () => {
    const saved = saveEnv();
    process.env.PHONE_LOGIN_ENABLED = "true";
    delete process.env.PHONE_ENC_KEY;
    delete process.env.PHONE_HASH_KEY;

    const res = await request(app)
      .post("/api/auth/phone/login/start")
      .send({ phone: TEST_PHONE });

    expect(res.status).toBe(404);
    restoreEnv(saved);
  });

  describe("with feature enabled", () => {
    let savedEnv;

    beforeEach(async () => {
      savedEnv = saveEnv();
      enablePhoneLoginEnv();
      mockTwilio();
      const password = await bcrypt.hash("password123", 4);
      adminUser = await User.create({
        username: `admin-${Date.now()}`,
        email: `admin-${Date.now()}@example.test`,
        userKey: uniqueKey(),
        practiceId: uniquePracticeId(),
        password,
        authProvider: "local",
        role: "admin",
        phoneVerified: true,
        phoneLookupHash: phoneLookupHash(TEST_PHONE),
        phoneEnc: encryptPhone(TEST_PHONE),
        phoneLast4: "2671",
      });
    });

    afterEach(() => {
      restoreEnv(savedEnv);
      resetTwilioFactoryForTests();
    });

    it("returns phone status for the signed-in user", async () => {
      const res = await request(app)
        .get("/api/auth/phone/status")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ phoneVerified: false, phoneLast4: null });
    });

    it("completes verify flow for an authenticated customer", async () => {
      const mocks = mockTwilio();

      const start = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: CUSTOMER_VERIFY_PHONE });

      expect(start.status).toBe(200);
      expect(mocks.verificationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: CUSTOMER_VERIFY_PHONE,
          rateLimits: { otp_daily_cap: "global" },
        }),
      );

      const confirm = await request(app)
        .post("/api/auth/phone/confirm-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: CUSTOMER_VERIFY_PHONE, code: TEST_CODE });

      expect(confirm.status).toBe(200);
      expect(confirm.body.phoneVerified).toBe(true);
      expect(confirm.body.phoneLast4).toBe("8989");

      const stored = await User.findById(customer._id).select("+phoneEnc +phoneLookupHash");
      expect(stored.phoneVerified).toBe(true);
      expect(stored.phoneEnc).toBeTruthy();
      expect(stored.phoneLookupHash).toBeTruthy();
    });

    it("logs in via SMS for a verified phone (including admin)", async () => {
      mockTwilio();

      const start = await request(app)
        .post("/api/auth/phone/login/start")
        .send({ phone: TEST_PHONE });

      expect(start.status).toBe(200);
      expect(start.body).toEqual({ message: LOGIN_START_MESSAGE });

      const verify = await request(app)
        .post("/api/auth/phone/login/verify")
        .send({ phone: TEST_PHONE, code: TEST_CODE });

      expect(verify.status).toBe(201);
      expect(verify.body.token).toBeTruthy();
      expect(verify.body.user).toBeTruthy();
      expect(String(verify.body.user._id || verify.body.user.id)).toBe(
        String(adminUser._id),
      );
    });

    it("does not reveal account existence on login start", async () => {
      const unknown = "+14155559999";
      const mocks = mockTwilio();

      const res = await request(app)
        .post("/api/auth/phone/login/start")
        .send({ phone: unknown });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: LOGIN_START_MESSAGE });
      expect(mocks.verificationsCreate).not.toHaveBeenCalled();
    }, 20000);

    it("enforces the global daily OTP cap", async () => {
      process.env.OTP_DAILY_CAP = "1";
      mockTwilio();

      const first = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: TEST_PHONE });

      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: "+14155558989" });

      expect(second.status).toBe(429);
    });

    it("locks out after repeated bad codes", async () => {
      mockTwilio({ approve: false });
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      for (let i = 0; i < 5; i += 1) {
        await request(app)
          .post("/api/auth/phone/login/verify")
          .send({ phone: TEST_PHONE, code: "000000" });
      }

      const locked = await request(app)
        .post("/api/auth/phone/login/verify")
        .send({ phone: TEST_PHONE, code: "000000" });

      expect(locked.status).toBe(429);
      const combined = JSON.stringify(errorSpy.mock.calls);
      expect(combined).not.toContain(TEST_PHONE);
      expect(combined).not.toContain("000000");
      errorSpy.mockRestore();
    });

    it("allows at most five Twilio verification checks under parallel bad codes", async () => {
      const mocks = mockTwilio({ approve: false });
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await Promise.all(
        Array.from({ length: 30 }, () =>
          request(app)
            .post("/api/auth/phone/login/verify")
            .send({ phone: TEST_PHONE, code: "000000" }),
        ),
      );

      expect(mocks.verificationChecksCreate.mock.calls.length).toBeLessThanOrEqual(5);
      errorSpy.mockRestore();
    });

    async function expectLoginStartMatchesUnknown(knownPhone) {
      const unknown = "+14155558801";
      const [knownRes, unknownRes] = await Promise.all([
        request(app).post("/api/auth/phone/login/start").send({ phone: knownPhone }),
        request(app).post("/api/auth/phone/login/start").send({ phone: unknown }),
      ]);
      expect(knownRes.status).toBe(200);
      expect(unknownRes.status).toBe(200);
      expect(knownRes.body).toEqual(unknownRes.body);
      expect(knownRes.body).toEqual({ message: LOGIN_START_MESSAGE });
    }

    it("login/start returns identical responses when the phone is locked", async () => {
      mockTwilio({ approve: false });
      for (let i = 0; i < 5; i += 1) {
        await request(app)
          .post("/api/auth/phone/login/verify")
          .send({ phone: TEST_PHONE, code: "000000" });
      }
      await resetDailyOtpCountersForTests();
      await deleteRateBucketsByPrefix("phone_otp_send");
      await expectLoginStartMatchesUnknown(TEST_PHONE);
    }, 20000);

    it("login/start returns identical responses when the daily cap is exceeded", async () => {
      process.env.OTP_DAILY_CAP = "1";
      mockTwilio();
      await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: CUSTOMER_VERIFY_PHONE });
      await deleteRateBucketsByPrefix("phone_otp_send");
      await expectLoginStartMatchesUnknown(TEST_PHONE);
    }, 20000);

    it("login/start returns identical responses when Twilio send fails", async () => {
      setTwilioFactoryForTests(() => ({
        verify: {
          v2: {
            services: () => ({
              verifications: {
                create: jest.fn().mockRejectedValue(Object.assign(new Error("fail"), { code: 500 })),
              },
              verificationChecks: { create: jest.fn() },
            }),
          },
        },
      }));
      await deleteRateBucketsByPrefix("phone_otp_send");
      await expectLoginStartMatchesUnknown(TEST_PHONE);
    }, 20000);

    it("rate limits rapid resends for the same phone", async () => {
      mockTwilio();

      const first = await request(app)
        .post("/api/auth/phone/login/start")
        .send({ phone: TEST_PHONE });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post("/api/auth/phone/login/start")
        .send({ phone: TEST_PHONE });
      expect(second.status).toBe(429);
    }, 20000);

    it("does not log OTP codes or full phone numbers on send failure", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      setTwilioFactoryForTests(() => ({
        verify: {
          v2: {
            services: () => ({
              verifications: {
                create: jest.fn().mockRejectedValue(new Error("twilio down")),
              },
              verificationChecks: { create: jest.fn() },
            }),
          },
        },
      }));

      await request(app)
        .post("/api/auth/phone/start-verify")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ phone: TEST_PHONE });

      const logs = JSON.stringify(errorSpy.mock.calls);
      expect(logs).not.toContain(TEST_PHONE);
      expect(logs).toContain("***2671");
      errorSpy.mockRestore();
    });
  });
});