const {
  getCountryOtpHourlyCap,
  getCountryOtpDailyCap,
} = require("./phoneLogin.config");
const { incrementRateBucket } = require("../../../shared/middleware/rateBucket");
const { utcDayKey } = require("./phoneOtpDailyCap");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function consumeCountryOtpSend(isoCountry) {
  const iso = String(isoCountry || "").toUpperCase();
  const hourCap = getCountryOtpHourlyCap(iso);
  const dayCap = getCountryOtpDailyCap(iso);
  const dayKey = utcDayKey();

  const { count: hourCount } = await incrementRateBucket(
    `phone_otp_send_country_hour:${iso}`,
    HOUR_MS,
  );
  if (hourCount > hourCap) {
    return { allowed: false, reason: "hour" };
  }

  const { count: dayCount } = await incrementRateBucket(
    `phone_otp_send_country_day:${iso}:${dayKey}`,
    DAY_MS,
  );
  if (dayCount > dayCap) {
    return { allowed: false, reason: "day" };
  }

  return { allowed: true, hourCount, dayCount, hourCap, dayCap };
}

module.exports = {
  consumeCountryOtpSend,
};