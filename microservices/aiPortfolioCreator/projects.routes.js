const express = require("express");
const {
  getProjects,
  addProject,
  getProjectById,
  updateProject,
  deleteProject,
} = require("./projects.controllers");

const router = express.Router();

router.get("/", getProjects);
router.post("/", addProject);
router.get("/:projectId", getProjectById);
router.delete("/:projectId", updateProject);
router.patch("/:projectId", deleteProject);

module.exports = router;
