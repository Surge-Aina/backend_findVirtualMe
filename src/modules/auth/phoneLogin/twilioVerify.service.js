let twilioFactory;

function getTwilioFactory() {
  if (!twilioFactory) {
    // eslint-disable-next-line global-require
    twilioFactory = require("twilio");
  }
  return twilioFactory;
}

function setTwilioFactoryForTests(factory) {
  twilioFactory = factory;
}

function resetTwilioFactoryForTests() {
  twilioFactory = null;
}

function buildVerifyClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !apiKeySid || !apiKeySecret || !serviceSid) {
    const err = new Error("twilio_not_configured");
    err.code = "twilio_not_configured";
    throw err;
  }
  const twilio = getTwilioFactory();
  const client = twilio(apiKeySid, apiKeySecret, { accountSid });
  return { client, serviceSid };
}

async function startVerification(e164) {
  const { client, serviceSid } = buildVerifyClient();
  return client.verify.v2.services(serviceSid).verifications.create({
    to: e164,
    channel: "sms",
    rateLimits: {
      otp_daily_cap: "global",
    },
  });
}

async function checkVerification(e164, code) {
  const { client, serviceSid } = buildVerifyClient();
  return client.verify.v2.services(serviceSid).verificationChecks.create({
    to: e164,
    code: String(code),
  });
}

module.exports = {
  startVerification,
  checkVerification,
  setTwilioFactoryForTests,
  resetTwilioFactoryForTests,
};