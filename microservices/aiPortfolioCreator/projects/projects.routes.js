const express = require("express");
const {
  getProjects,
  addProject,
  getProjectById,
  updateProject,
  deleteProject,
} = require("./projects.controllers");
const auth = require("../../../middleware/auth");

const router = express.Router();

router.get("/", auth, getProjects);
router.post("/", auth, addProject);
router.get("/:projectId", auth, getProjectById);
router.delete("/:projectId", auth, updateProject);
router.patch("/:projectId", auth, deleteProject);

module.exports = router;
