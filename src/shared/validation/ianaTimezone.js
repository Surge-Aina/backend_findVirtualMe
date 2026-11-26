function isValidIanaTimezone(timezone) {
  if (typeof timezone !== "string" || !timezone.trim()) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone.trim() }).format(new Date());
    return true;
  } catch (_err) {
    return false;
  }
}

function assertValidIanaTimezone(timezone, path = "timezone") {
  if (!isValidIanaTimezone(timezone)) {
    const err = new Error(`${path} must be a valid IANA timezone`);
    err.name = "TimezoneValidationError";
    err.path = path;
    throw err;
  }
  return timezone.trim();
}

module.exports = {
  isValidIanaTimezone,
  assertValidIanaTimezone,
};