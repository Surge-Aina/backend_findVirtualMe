const express = require("express");
const router = express.Router();
const auth = require("../../../middleware/auth");
const {
  getPublicProjects,
  getPublicProjectsFromUser,
  togglePublicStatus,
} = require("./publicProjectsAccess.controller");

router.get("/", getPublicProjects);
router.get("/:userId", getPublicProjectsFromUser);
router.patch("/togglePublic/:projectId", auth, togglePublicStatus);

module.exports = router;
