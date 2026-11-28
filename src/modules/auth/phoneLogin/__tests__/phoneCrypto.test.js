const crypto = require("crypto");
const {
  encryptPhone,
  decryptPhone,
  normalizeE164,
  maskPhoneForLog,
  phoneLast4,
} = require("../phoneCrypto");

describe("phoneCrypto", () => {
  const encKey = crypto.randomBytes(32).toString("base64");
  const hashKey = crypto.randomBytes(32).toString("base64");

  beforeEach(() => {
    process.env.PHONE_ENC_KEY = encKey;
    process.env.PHONE_HASH_KEY = hashKey;
  });

  test("normalizes and validates E.164", () => {
    expect(normalizeE164("+14155552671")).toBe("+14155552671");
    expect(normalizeE164("(415) 555-2671", "US")).toBe("+14155552671");
    expect(normalizeE164("(415) 555-2671")).toBeNull();
    expect(normalizeE164("not-a-phone")).toBeNull();
  });

  test("encryption round-trip", () => {
    const e164 = "+14155552671";
    const enc = encryptPhone(e164);
    expect(enc).toBeTruthy();
    expect(decryptPhone(enc)).toBe(e164);
  });

  test("masks phone for logs", () => {
    expect(phoneLast4("+14155552671")).toBe("2671");
    expect(maskPhoneForLog("+14155552671")).toBe("***2671");
    expect(maskPhoneForLog("+14155552671")).not.toContain("415");
  });
});