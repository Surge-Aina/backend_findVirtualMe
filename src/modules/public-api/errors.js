/**
 * Error body for the public API and developer key management.
 * Shape: { error: { code, message, details? } }
 * Never attach secrets, tokens, emails, names, or phone numbers.
 */
function sendError(res, status, code, message, details) {
  const error = { code, message };
  if (details && typeof details === "object" && Object.keys(details).length > 0) {
    error.details = details;
  }
  return res.status(status).json({ error });
}

module.exports = { sendError };
