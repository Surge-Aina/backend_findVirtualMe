const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/portfolio.controller");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");

// Public (static paths before param routes)
router.get("/public", ctrl.listPublic);
router.get("/block-types", ctrl.getBlockTypes);
router.get("/slug/:slug", optionalAuth, ctrl.getBySlug);

// Authenticated (must precede /:id to avoid being captured by the param route)
router.get("/mine", auth, ctrl.getMine);
router.post("/", auth, ctrl.create);
router.post("/agent", auth, ctrl.createAgent);
router.post("/agent/generate", auth, ctrl.generateAgentFromPrompt);
router.post("/:id/agent-edit", auth, ctrl.proposeAgentEdit);

// Public param route
router.get("/:id", optionalAuth, ctrl.getById);
router.patch("/:id", auth, ctrl.update);
router.patch("/:id/sections/:sectionId", auth, ctrl.updateSection);
router.post("/:id/sections", auth, ctrl.addSection);
router.delete("/:id/sections/:sectionId", auth, ctrl.removeSection);
router.patch("/:id/reorder", auth, ctrl.reorderSections);
router.patch("/:id/visibility", auth, ctrl.toggleVisibility);
router.patch("/:id/branding", auth, ctrl.toggleBranding);
router.delete("/:id", auth, ctrl.remove);

module.exports = router;
