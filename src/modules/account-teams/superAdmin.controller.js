const { isAccountTeamsEnabled } = require("../../shared/config/accountTeams");
const { authenticateSuperAdmin } = require("./superAdmin.service");

exports.login = async (req, res) => {
  try {
    if (!isAccountTeamsEnabled()) {
      return res.status(404).json({ error: "Account teams are not enabled", code: "ACCOUNT_TEAMS_DISABLED" });
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await authenticateSuperAdmin(email, password);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({
      success: true,
      token: result.token,
      user: { id: result.user.id, role: "super_admin" },
    });
  } catch (err) {
    console.error("superAdmin.login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};