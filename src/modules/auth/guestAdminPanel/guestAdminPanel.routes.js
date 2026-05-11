// guestAdminPanel.routes.js
const express = require("express");
const {
  getAllUsers,
  editUser,
  createUserAsOwner,
} = require("./guestAdminPanel.controller");
const ownerAuth = require("../../../shared/middleware/auth");
const activityController = require("../../portfolio-activities/portfolioActivity.controller");

const router = express.Router();

router.get("/users", getAllUsers);
router.put("/users/:id", editUser);

// New owner-protected endpoints for the sub-user / activity admin UI.
router.post("/users", ownerAuth, createUserAsOwner);

router.get("/activities", ownerAuth, activityController.listAsOwner);
router.post("/activities", ownerAuth, activityController.createAsOwner);
router.patch("/activities/:id", ownerAuth, activityController.updateAsOwner);

module.exports = router;
