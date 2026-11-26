/**
 * Booking window rules inspired by common scheduling products (patterns only;
 * no AGPL scheduling code vendored — e.g. Cal.com-style notice and horizon caps).
 */

class BookingWindowError extends Error {
  constructor(message, { code = "validation_error", details } = {}) {
    super(message);
    this.name = "BookingWindowError";
    this.code = code;
    this.details = details;
  }
}

const { assertValidIanaTimezone } = require("../../shared/validation/ianaTimezone");

function parseInstant(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BookingWindowError(`${path} must be an ISO 8601 datetime`, {
      code: "validation_error",
      details: { field: path },
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BookingWindowError(`${path} must be a valid datetime`, {
      code: "validation_error",
      details: { field: path },
    });
  }
  return date;
}

function validateRequestedWindow({
  requestedStart,
  requestedEnd,
  minNoticeHours,
  daysAheadMax,
  timezone,
  now = new Date(),
}) {
  const start = parseInstant(requestedStart, "requestedStart");
  const end = parseInstant(requestedEnd, "requestedEnd");
  if (end.getTime() < start.getTime()) {
    throw new BookingWindowError("requestedEnd must be on or after requestedStart", {
      code: "validation_error",
      details: { field: "requestedEnd" },
    });
  }

  const noticeMs = Math.max(0, Number(minNoticeHours) || 0) * 60 * 60 * 1000;
  const earliest = new Date(now.getTime() + noticeMs);
  if (start.getTime() < earliest.getTime()) {
    throw new BookingWindowError("Requested time is too soon", {
      code: "booking_window_too_soon",
      details: { field: "requestedStart", minNoticeHours },
    });
  }

  const horizonDays = Math.max(1, Number(daysAheadMax) || 1);
  const latest = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  if (start.getTime() > latest.getTime()) {
    throw new BookingWindowError("Requested time is too far in the future", {
      code: "booking_window_too_far",
      details: { field: "requestedStart", daysAheadMax: horizonDays },
    });
  }

  assertValidIanaTimezone(timezone, "timezone");

  return { start, end, timezone: timezone.trim() };
}

module.exports = {
  BookingWindowError,
  parseInstant,
  validateRequestedWindow,
};