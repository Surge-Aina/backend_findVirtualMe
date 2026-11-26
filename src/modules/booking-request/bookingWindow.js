/**
 * Booking window rules inspired by common scheduling products (patterns only;
 * no AGPL scheduling code vendored — e.g. Cal.com-style notice and horizon caps).
 */

const { DateTime } = require("luxon");
const { assertValidIanaTimezone } = require("../../shared/validation/ianaTimezone");

class BookingWindowError extends Error {
  constructor(message, { code = "validation_error", details } = {}) {
    super(message);
    this.name = "BookingWindowError";
    this.code = code;
    this.details = details;
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function hasExplicitOffset(value) {
  return /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
}

function parseRequestedInstant(value, path, timezone) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BookingWindowError(`${path} must be an ISO 8601 datetime`, {
      code: "validation_error",
      details: { field: path },
    });
  }
  const trimmed = value.trim();
  if (DATE_ONLY.test(trimmed)) {
    throw new BookingWindowError(`${path} must include a time of day`, {
      code: "validation_error",
      details: { field: path, reason: "date_only" },
    });
  }
  if (!trimmed.includes("T")) {
    throw new BookingWindowError(`${path} must be an ISO 8601 datetime`, {
      code: "validation_error",
      details: { field: path },
    });
  }

  let dt;
  if (hasExplicitOffset(trimmed)) {
    dt = DateTime.fromISO(trimmed, { setZone: true });
  } else {
    dt = DateTime.fromISO(trimmed, { zone: timezone });
  }
  if (!dt.isValid) {
    throw new BookingWindowError(`${path} must be a valid datetime`, {
      code: "validation_error",
      details: { field: path, reason: dt.invalidReason },
    });
  }
  return dt;
}

function clampMinNoticeHours(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 24;
  return Math.min(168, Math.max(0, Math.round(num)));
}

function clampDaysAheadMax(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 30;
  return Math.min(365, Math.max(1, Math.round(num)));
}

function validateRequestedWindow({
  requestedStart,
  requestedEnd,
  minNoticeHours,
  daysAheadMax,
  timezone,
  now = DateTime.now(),
}) {
  const tz = assertValidIanaTimezone(timezone, "timezone");
  const noticeHours = clampMinNoticeHours(minNoticeHours);
  const horizonDays = clampDaysAheadMax(daysAheadMax);

  const start = parseRequestedInstant(requestedStart, "requestedStart", tz);
  const end = parseRequestedInstant(requestedEnd, "requestedEnd", tz);

  if (end.toMillis() < start.toMillis()) {
    throw new BookingWindowError("requestedEnd must be on or after requestedStart", {
      code: "validation_error",
      details: { field: "requestedEnd" },
    });
  }

  const earliest = now.plus({ hours: noticeHours });
  if (start.toMillis() < earliest.toMillis()) {
    throw new BookingWindowError("Requested time is too soon", {
      code: "booking_window_too_soon",
      details: { field: "requestedStart", minNoticeHours: noticeHours },
    });
  }

  const localNow = now.setZone(tz);
  const lastCalendarDay = localNow.startOf("day").plus({ days: horizonDays });
  const startLocalDay = start.setZone(tz).startOf("day");
  if (startLocalDay.toMillis() > lastCalendarDay.toMillis()) {
    throw new BookingWindowError("Requested time is too far in the future", {
      code: "booking_window_too_far",
      details: { field: "requestedStart", daysAheadMax: horizonDays },
    });
  }

  return {
    start,
    end,
    timezone: tz,
    minNoticeHours: noticeHours,
    daysAheadMax: horizonDays,
  };
}

module.exports = {
  BookingWindowError,
  parseRequestedInstant,
  validateRequestedWindow,
  clampMinNoticeHours,
  clampDaysAheadMax,
};