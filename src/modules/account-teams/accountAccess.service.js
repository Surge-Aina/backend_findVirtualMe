const Portfolio = require("../portfolios/models/Portfolio");
const AccountMembership = require("./models/AccountMembership");
const { isAccountTeamsEnabled } = require("../../shared/config/accountTeams");
const { isSuperAdminUser, logSuperAdminAction } = require("./superAdmin.service");

const ROLE_RANK = { viewer: 1, editor: 2, account_admin: 3 };

function isPortfolioPlatformAdmin(user) {
  return user?.role === "admin";
}

async function getActiveMembership(accountId, userId) {
  if (!accountId || !userId) return null;
  return AccountMembership.findOne({
    account: accountId,
    user: userId,
    status: "active",
  })
    .select("role account user")
    .lean();
}

async function getViewerMembershipForPortfolio(portfolio, userId) {
  if (!portfolio?.account || !userId) return null;
  return getActiveMembership(portfolio.account, userId);
}

async function canUserViewPortfolio(portfolio, user) {
  if (!portfolio) return false;
  if (isSuperAdminUser(user) || isPortfolioPlatformAdmin(user)) return true;
  if (portfolio.visibility === "public") return true;
  const userId = user?._id || user?.id;
  if (!userId) return false;
  if (portfolio.owner?.toString?.() === userId.toString()) return true;
  if (!isAccountTeamsEnabled()) return false;
  const membership = await getViewerMembershipForPortfolio(portfolio, userId);
  return Boolean(membership);
}

/**
 * Mutation access: legacy owner + platform admin, or team editor/admin when flag on.
 */
async function assertPortfolioMutationAccess(portfolioId, user, { isAdmin = false } = {}) {
  const userId = user?._id || user?.id;
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!isAccountTeamsEnabled()) {
    return null;
  }

  if (isSuperAdminUser(user)) {
    const doc = await Portfolio.findById(portfolioId).select("owner account").lean();
    if (!doc) return { ok: false, status: 404, error: "Portfolio not found" };
    return { ok: true, isOwner: false, isSuperAdmin: true };
  }

  if (isAdmin || isPortfolioPlatformAdmin(user)) {
    const doc = await Portfolio.findById(portfolioId).select("owner").lean();
    if (!doc) return { ok: false, status: 404, error: "Portfolio not found" };
    const isOwner = doc.owner?.toString() === userId.toString();
    if (isOwner) return { ok: true, isOwner: true };
    if (isAdmin) return { ok: true, isOwner: false };
  }

  const doc = await Portfolio.findById(portfolioId).select("owner account").lean();
  if (!doc) return { ok: false, status: 404, error: "Portfolio not found" };

  const isOwner = doc.owner?.toString() === userId.toString();
  if (isOwner) return { ok: true, isOwner: true };

  if (doc.account) {
    const membership = await getActiveMembership(doc.account, userId);
    if (membership && ROLE_RANK[membership.role] >= ROLE_RANK.editor) {
      return { ok: true, isOwner: false, membershipRole: membership.role };
    }
  }

  return { ok: false, status: 403, error: "Forbidden" };
}

function logCrossAccountSuperAdminEdit(user, portfolioId, action) {
  if (!isSuperAdminUser(user)) return;
  logSuperAdminAction(user._id || user.id, action, { portfolioId });
}

module.exports = {
  ROLE_RANK,
  isPortfolioPlatformAdmin,
  getActiveMembership,
  canUserViewPortfolio,
  assertPortfolioMutationAccess,
  logCrossAccountSuperAdminEdit,
};