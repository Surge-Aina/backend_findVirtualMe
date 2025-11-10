// controllers/exec.controllers.js
const execService = require("./exec.service");

exports.handleExec = async (req, res) => {
  try {
    const { action, args } = req.body || {};
    const result = await execService.executeAction(action, args);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("Exec controller error:", err);
    const status = err.statusCode || 500;
    res.status(status).json({ ok: false, error: err.message });
  }
};
