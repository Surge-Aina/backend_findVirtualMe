const AccountMembership = require("./models/AccountMembership");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function activateInvitedMembershipsForUser(user) {
  if (!user?._id || !user?.email) return { activated: 0 };
  const email = normalizeEmail(user.email);
  const result = await AccountMembership.updateMany(
    { email, status: "invited" },
    { $set: { user: user._id, status: "active" } }
  );
  return { activated: result.modifiedCount || 0 };
}

module.exports = {
  activateInvitedMembershipsForUser,
};