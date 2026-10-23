/**
 * Ensures appTheme is always "light" | "dark" for API responses (legacy docs may omit it).
 */
function normalizeUserAppTheme(userDoc) {
  if (!userDoc) return userDoc;
  const u =
    typeof userDoc.toObject === "function"
      ? userDoc.toObject()
      : { ...userDoc };
  delete u.password;
  delete u.resetPasswordToken;
  delete u.resetPasswordExpires;
  return { ...u, appTheme: u.appTheme === "dark" ? "dark" : "light" };
}

module.exports = { normalizeUserAppTheme };
