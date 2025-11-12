const express = require("express");
const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");
const auth = require("../../../middleware/auth");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  // const user = await userUtils.getOrCreateUser(req.user._id);
  const user = req.user;
  res.json({
    userKey: user.userKey,
    displayName: user.displayName,
    activeProjectId: user.activeProjectId,
    projects: user.projects
      .filter((p) => p.status !== "deleted")
      .map(helpers.projectToClient),
    time: helpers.nowIso(),
  });
});

module.exports = router;
