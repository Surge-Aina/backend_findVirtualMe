const { DateTime } = require("luxon");
const {
  validateRequestedWindow,
  parseRequestedInstant,
  BookingWindowError,
} = require("../bookingWindow");

describe("bookingWindow (Luxon)", () => {
  const tz = "America/New_York";

  it("rejects date-only strings", () => {
    expect(() =>
      validateRequestedWindow({
        requestedStart: "2026-06-01",
        requestedEnd: "2026-06-01T12:00",
        minNoticeHours: 0,
        daysAheadMax: 30,
        timezone: tz,
        now: DateTime.fromISO("2026-05-01T12:00:00", { zone: tz }),
      })
    ).toThrow(BookingWindowError);
  });

  it("interprets naive datetimes in the site timezone", () => {
    const now = DateTime.fromISO("2026-06-01T10:00:00", { zone: tz });
    const parsed = parseRequestedInstant("2026-06-02T14:00:00", "requestedStart", tz);
    expect(parsed.zoneName).toBe(tz);
    expect(() =>
      validateRequestedWindow({
        requestedStart: "2026-06-02T14:00:00",
        requestedEnd: "2026-06-02T15:00:00",
        minNoticeHours: 0,
        daysAheadMax: 30,
        timezone: tz,
        now,
      })
    ).not.toThrow();
  });

  it("uses calendar-day horizon in the site timezone", () => {
    const now = DateTime.fromISO("2026-06-01T10:00:00", { zone: tz });
    expect(() =>
      validateRequestedWindow({
        requestedStart: "2026-07-03T09:00:00",
        requestedEnd: "2026-07-03T10:00:00",
        minNoticeHours: 0,
        daysAheadMax: 30,
        timezone: tz,
        now,
      })
    ).toThrow(/too far/);
  });

  it("handles DST spring-forward when interpreting wall time", () => {
    const now = DateTime.fromISO("2026-03-07T10:00:00", { zone: tz });
    const parsed = parseRequestedInstant("2026-03-08T02:30:00", "requestedStart", tz);
    expect(parsed.isValid).toBe(true);
    expect(() =>
      validateRequestedWindow({
        requestedStart: "2026-03-08T02:30:00",
        requestedEnd: "2026-03-08T11:00:00",
        minNoticeHours: 0,
        daysAheadMax: 14,
        timezone: tz,
        now,
      })
    ).not.toThrow();
  });
});