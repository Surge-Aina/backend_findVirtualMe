const SUPER_ADMIN_USER_ID = "000000000000000000000001";

function isAccountTeamsEnabled() {
  return process.env.ACCOUNT_TEAMS_ENABLED === "true";
}

function getSuperAdminUserId() {
  return SUPER_ADMIN_USER_ID;
}

module.exports = {
  isAccountTeamsEnabled,
  getSuperAdminUserId,
  SUPER_ADMIN_USER_ID,
};