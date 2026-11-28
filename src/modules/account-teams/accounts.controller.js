const { isAccountTeamsEnabled } = require("../../shared/config/accountTeams");
const accountsService = require("./accounts.service");
const { isSuperAdminUser } = require("./superAdmin.service");

function teamsDisabled(res) {
  return res.status(404).json({ error: "Account teams are not enabled", code: "ACCOUNT_TEAMS_DISABLED" });
}

exports.listMine = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const accounts = await accountsService.listAccountsForUser(req.user);
    res.json({ success: true, accounts });
  } catch (err) {
    console.error("accounts.listMine error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.create = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const account = await accountsService.createAccount(req.user, req.body || {});
    res.status(201).json({ success: true, account });
  } catch (err) {
    console.error("accounts.create error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.listMembers = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const members = await accountsService.listMembers(req.params.accountId, req.user);
    res.json({ success: true, members });
  } catch (err) {
    console.error("accounts.listMembers error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.addMember = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const { email, role } = req.body || {};
    if (!email || !role) {
      return res.status(400).json({ error: "email and role are required" });
    }
    const member = await accountsService.addMemberByEmail(req.params.accountId, req.user, {
      email,
      role,
    });
    res.status(201).json({ success: true, member });
  } catch (err) {
    console.error("accounts.addMember error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.updateMember = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: "role is required" });
    const member = await accountsService.updateMemberRole(
      req.params.accountId,
      req.user,
      req.params.membershipId,
      role
    );
    res.json({ success: true, member });
  } catch (err) {
    console.error("accounts.updateMember error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.removeMember = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const result = await accountsService.removeMember(
      req.params.accountId,
      req.user,
      req.params.membershipId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("accounts.removeMember error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.listAccountPortfolios = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    const accountId = req.params.accountId;
    const portfolios = await accountsService.getPortfoliosForAccount(req.user, accountId);
    res.json({ success: true, portfolios });
  } catch (err) {
    console.error("accounts.listAccountPortfolios error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
};

exports.listAllAccountsForSuperAdmin = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) return teamsDisabled(res);
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const accounts = await accountsService.listAccountsForUser(req.user);
    res.json({ success: true, accounts });
  } catch (err) {
    console.error("accounts.listAllAccountsForSuperAdmin error:", err);
    res.status(500).json({ error: "Server error" });
  }
};