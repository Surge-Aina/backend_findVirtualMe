// const express = require("express");
// const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils.js");

// const router = express.Router();

// router.post("/:projectId", async (req, res) => {
//   const { projectId } = req.params;
//   const user = await userUtils.getOrCreateUser();
//   const idx = user.projects.findIndex(
//     (p) => p.projectId === projectId && p.status !== "deleted"
//   );
//   if (idx === -1) return res.status(404).json({ ok: false, error: "Project not found" });
//   user.activeProjectId = projectId;
//   user.updatedAt = new Date();
//   await user.save();
//   res.json({ ok: true, activeProjectId: projectId });
// });

// module.exports = router;
// routes/setActiveProject.route.js
const express = require("express");
const { setActiveProject } = require("./setActiveProject.controller");
const auth = require("../../../middleware/auth");
const router = express.Router();

router.post("/:projectId", auth, setActiveProject);

module.exports = router;
