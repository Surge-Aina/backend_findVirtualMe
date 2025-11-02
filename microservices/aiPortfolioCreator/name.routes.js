const express = require("express");
const router = express.Router();
const { userUtils, helpers } = require("./utils/aiPortfolioCreator.utils");
router.get("/", async (_req, res) => {
  const user = await userUtils.getOrCreateUser();
  const proj = user.projects.find(
    (p) => p.projectId === user.activeProjectId && p.status !== "deleted"
  );
  const name = proj?.dataJson?.name || "";
  res.json({ name });
});
router.post("/", async (req, res) => {
  const user = await userUtils.getOrCreateUser();
  const proj = user.projects.find(
    (p) => p.projectId === user.activeProjectId && p.status !== "deleted"
  );
  if (!proj) return res.status(404).json({ ok: false, error: "No active project" });
  const incoming = (req.body && req.body.name) || "";
  proj.dataJson.name = incoming;
  proj.updatedAt = new Date();
  user.updatedAt = new Date();
  await user.save();
  res.json({ name: incoming });
});

module.exports = router;
