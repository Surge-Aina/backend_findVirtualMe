/**
 * Shared bot-trap checks for public lead forms (contact and booking request).
 * Honeypot field must stay empty; a filled trap is treated as spam (silent 201).
 */

const HONEYPOT_FIELD = "_hp";

function isHoneypotTripped(body) {
  if (!body || typeof body !== "object") return false;
  const trap = body[HONEYPOT_FIELD];
  if (trap === undefined || trap === null || trap === "") return false;
  return true;
}

function silentlyAcceptSpam(res) {
  return res.status(201).json({
    success: true,
    message: "Request received",
  });
}

module.exports = {
  HONEYPOT_FIELD,
  isHoneypotTripped,
  silentlyAcceptSpam,
};