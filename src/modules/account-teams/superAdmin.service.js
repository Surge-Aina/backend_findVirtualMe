const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  isAccountTeamsEnabled,
  getSuperAdminUserId,
} = require("../../shared/config/accountTeams");

function buildSuperAdminUser() {
  const id = getSuperAdminUserId();
  return {
    _id: id,
    id,
    role: "super_admin",
    isSuperAdmin: true,
  };
}

function isSuperAdminUser(user) {
  return Boolean(user?.isSuperAdmin || user?.role === "super_admin");
}

function superAdminEnvConfigured() {
  return Boolean(
    process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD_HASH
  );
}

async function authenticateSuperAdmin(email, password) {
  if (!isAccountTeamsEnabled() || !superAdminEnvConfigured()) {
    return { ok: false, status: 404, error: "Not found" };
  }
  const expectedEmail = String(process.env.SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const supplied = String(email || "").trim().toLowerCase();
  if (supplied !== expectedEmail) {
    return { ok: false, status: 401, error: "Invalid credentials" };
  }
  const match = await bcrypt.compare(
    String(password || ""),
    process.env.SUPER_ADMIN_PASSWORD_HASH
  );
  if (!match) {
    return { ok: false, status: 401, error: "Invalid credentials" };
  }
  const user = buildSuperAdminUser();
  const token = jwt.sign(
    { id: user.id, kind: "super_admin" },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  return { ok: true, token, user };
}

function logSuperAdminAction(actorId, action, details = {}) {
  console.info(
    JSON.stringify({
      event: "super_admin_action",
      actorId: String(actorId),
      action: String(action),
      ...Object.fromEntries(
        Object.entries(details).map(([k, v]) => [k, v != null ? String(v) : ""])
      ),
    })
  );
}

module.exports = {
  buildSuperAdminUser,
  isSuperAdminUser,
  superAdminEnvConfigured,
  authenticateSuperAdmin,
  logSuperAdminAction,
};