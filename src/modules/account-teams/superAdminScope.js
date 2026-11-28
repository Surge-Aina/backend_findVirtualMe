const { isSuperAdminUser } = require("./superAdmin.service");

const ALLOWED_PREFIXES = ["/api/accounts", "/api/portfolios", "/api/admin"];

function normalizePath(req) {
  const raw = req.originalUrl || req.url || "";
  return raw.split("?")[0] || "";
}

function isSuperAdminPathAllowed(req) {
  const path = normalizePath(req);
  return ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function rejectUnlessSuperAdminPathAllowed(req, res) {
  if (!isSuperAdminPathAllowed(req)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

module.exports = {
  ALLOWED_PREFIXES,
  isSuperAdminPathAllowed,
  rejectUnlessSuperAdminPathAllowed,
  isSuperAdminUser,
};