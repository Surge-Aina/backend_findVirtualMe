// controllers/setActiveProject.controller.js
const { userUtils } = require("../utils/aiPortfolioCreator.utils");

exports.setActiveProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    // const user = await userUtils.getOrCreateUser(req.user._id);
    const user = req.user;

    const idx = user.projects.findIndex(
      (p) => p.projectId === projectId && p.status !== "deleted"
    );

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    user.activeProjectId = projectId;
    user.updatedAt = new Date();
    await user.save();

    res.json({ ok: true, activeProjectId: projectId });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};
