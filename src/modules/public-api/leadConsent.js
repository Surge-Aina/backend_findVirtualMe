/**
 * Optional contact-form consent.
 * Absent means the form did not ask. A boolean means the visitor answered.
 */

function parseConsent(input) {
  if (typeof input === "boolean") return { contact: input };
  if (typeof input === "string") {
    const value = input.trim().toLowerCase();
    if (value === "true" || value === "1" || value === "yes" || value === "on") {
      return { contact: true };
    }
    if (value === "false" || value === "0" || value === "no" || value === "off") {
      return { contact: false };
    }
    return null;
  }
  if (input && typeof input === "object") {
    if (typeof input.contact === "boolean") return { contact: input.contact };
    if (typeof input.contact === "string") return parseConsent(input.contact);
  }
  return null;
}

function consentContactFromBody(body) {
  if (!body || typeof body !== "object") return undefined;
  let raw;
  if (Object.prototype.hasOwnProperty.call(body, "consent")) raw = body.consent;
  else if (Object.prototype.hasOwnProperty.call(body, "consentContact")) raw = body.consentContact;
  else return undefined;
  const parsed = parseConsent(raw);
  if (!parsed) return undefined;
  return parsed.contact;
}

function consentFromStored(value) {
  if (typeof value === "boolean") return { contact: value };
  return parseConsent(value);
}

module.exports = {
  parseConsent,
  consentContactFromBody,
  consentFromStored,
};
