const Account = require("./models/Account");
const AccountMembership = require("./models/AccountMembership");
const User = require("../../shared/models/User");
const Portfolio = require("../portfolios/models/Portfolio");
const { ROLE_RANK } = require("./accountAccess.service");
const { isSuperAdminUser, logSuperAdminAction } = require("./superAdmin.service");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function requireAccountAdmin(accountId, userId) {
  const membership = await AccountMembership.findOne({
    account: accountId,
    user: userId,
    status: "active",
    role: "account_admin",
  }).lean();
  if (membership) return membership;
  const err = new Error("Forbidden");
  err.status = 403;
  throw err;
}

async function listAccountsForUser(user) {
  if (isSuperAdminUser(user)) {
    const accounts = await Account.find({}).sort({ updatedAt: -1 }).lean();
    return accounts.map((a) => ({
      id: a._id,
      name: a.name,
      role: "super_admin",
    }));
  }
  const memberships = await AccountMembership.find({
    user: user._id,
    status: "active",
  })
    .sort({ updatedAt: -1 })
    .lean();
  if (!memberships.length) return [];

  const accountIds = memberships.map((m) => m.account);
  const accounts = await Account.find({ _id: { $in: accountIds } }).lean();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));

  return memberships.map((m) => {
    const account = byId.get(String(m.account));
    return {
      id: m.account,
      name: account?.name || "Workspace",
      role: m.role,
    };
  });
}

async function listMembers(accountId, actor) {
  if (isSuperAdminUser(actor)) {
    logSuperAdminAction(actor._id, "list_members", { accountId });
  } else {
    await requireAccountAdmin(accountId, actor._id);
  }

  const rows = await AccountMembership.find({ account: accountId })
    .sort({ createdAt: 1 })
    .lean();

  const superEmail = process.env.SUPER_ADMIN_EMAIL
    ? String(process.env.SUPER_ADMIN_EMAIL).trim().toLowerCase()
    : null;

  return rows
    .filter((row) => row.role !== "super_admin")
    .filter((row) => !superEmail || normalizeEmail(row.email) !== superEmail)
    .map((row) => ({
      id: row._id,
      userId: row.user ? String(row.user) : null,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

async function addMemberByEmail(accountId, actor, { email, role }) {
  if (!["account_admin", "editor", "viewer"].includes(role)) {
    const err = new Error("Invalid role");
    err.status = 400;
    throw err;
  }

  const normalized = normalizeEmail(email);

  if (isSuperAdminUser(actor)) {
    logSuperAdminAction(actor._id, "add_member", { accountId, role });
  } else {
    await requireAccountAdmin(accountId, actor._id);
  }

  const existingUser = await User.findOne({ email: normalized }).select("_id email").lean();
  const membership = await AccountMembership.findOneAndUpdate(
    { account: accountId, email: normalized },
  {
      $set: {
        user: existingUser?._id || null,
        role,
        status: existingUser ? "active" : "invited",
        invitedBy: isSuperAdminUser(actor) ? null : actor._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  return {
    id: membership._id,
    userId: membership.user ? String(membership.user) : null,
    email: membership.email,
    role: membership.role,
    status: membership.status,
  };
}

async function updateMemberRole(accountId, actor, membershipId, role) {
  if (!["account_admin", "editor", "viewer"].includes(role)) {
    const err = new Error("Invalid role");
    err.status = 400;
    throw err;
  }
  if (isSuperAdminUser(actor)) {
    logSuperAdminAction(actor._id, "update_member_role", { accountId, membershipId, role });
  } else {
    await requireAccountAdmin(accountId, actor._id);
  }

  const target = await AccountMembership.findOne({ _id: membershipId, account: accountId }).lean();
  if (!target) {
    const err = new Error("Membership not found");
    err.status = 404;
    throw err;
  }

  if (
    !isSuperAdminUser(actor) &&
    target.role === "account_admin" &&
    role !== "account_admin" &&
    target.status === "active"
  ) {
    const adminCount = await AccountMembership.countDocuments({
      account: accountId,
      role: "account_admin",
      status: "active",
    });
    if (adminCount <= 1) {
      const err = new Error("Cannot demote the last account admin");
      err.status = 400;
      throw err;
    }
  }

  const updated = await AccountMembership.findOneAndUpdate(
    { _id: membershipId, account: accountId },
    { $set: { role } },
    { new: true }
  ).lean();
  if (!updated) {
    const err = new Error("Membership not found");
    err.status = 404;
    throw err;
  }
  return {
    id: updated._id,
    userId: updated.user ? String(updated.user) : null,
    email: updated.email,
    role: updated.role,
    status: updated.status,
  };
}

async function removeMember(accountId, actor, membershipId) {
  if (isSuperAdminUser(actor)) {
    logSuperAdminAction(actor._id, "remove_member", { accountId, membershipId });
  } else {
    await requireAccountAdmin(accountId, actor._id);
  }

  const target = await AccountMembership.findOne({ _id: membershipId, account: accountId }).lean();
  if (!target) {
    const err = new Error("Membership not found");
    err.status = 404;
    throw err;
  }

  if (!isSuperAdminUser(actor) && target.role === "account_admin") {
    const adminCount = await AccountMembership.countDocuments({
      account: accountId,
      role: "account_admin",
      status: "active",
    });
    if (adminCount <= 1) {
      const err = new Error("Cannot remove the last account admin");
      err.status = 400;
      throw err;
    }
  }

  await AccountMembership.deleteOne({ _id: membershipId });
  return { removed: true };
}

async function createAccount(actor, { name } = {}) {
  if (isSuperAdminUser(actor)) {
    const err = new Error("Super admin cannot create accounts via this endpoint");
    err.status = 403;
    throw err;
  }
  const account = await Account.create({
    name: name?.trim() || "Workspace",
    createdBy: actor._id,
  });
  const email = normalizeEmail(actor.email);
  await AccountMembership.create({
    account: account._id,
    user: actor._id,
    email,
    role: "account_admin",
    status: "active",
  });
  return { id: account._id, name: account.name, role: "account_admin" };
}

async function getPortfoliosForAccount(user, accountId) {
  if (!accountId) {
    return Portfolio.find({ owner: user._id }).sort({ updatedAt: -1 }).lean();
  }
  if (isSuperAdminUser(user)) {
    return Portfolio.find({ account: accountId }).sort({ updatedAt: -1 }).lean();
  }
  const membership = await AccountMembership.findOne({
    account: accountId,
    user: user._id,
    status: "active",
  }).lean();
  if (!membership) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return Portfolio.find({ account: accountId }).sort({ updatedAt: -1 }).lean();
}

function assertRoleAtLeast(membership, minRole) {
  if (!membership) return false;
  return ROLE_RANK[membership.role] >= ROLE_RANK[minRole];
}

module.exports = {
  listAccountsForUser,
  listMembers,
  addMemberByEmail,
  updateMemberRole,
  removeMember,
  createAccount,
  getPortfoliosForAccount,
  requireAccountAdmin,
  assertRoleAtLeast,
  normalizeEmail,
};