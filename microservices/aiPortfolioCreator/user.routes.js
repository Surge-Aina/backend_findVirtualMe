const express = require("express");
const { userUtils, helpers } = require("./utils/aiPortfolioCreator.utils.js");

const router = express.Router();

router.get("/", async (_req, res) => {
  const user = await userUtils.getOrCreateUser();
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
