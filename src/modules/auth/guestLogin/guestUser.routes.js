const express = require("express");
const router = express.Router();
const controller = require("./guestUser.controller");
const auth = require("./auth");
const activityController = require("../../portfolio-activities/portfolioActivity.controller");

router.post("/login", controller.loginUser);
router.post("/signup", controller.signupUser);

router.patch("/profile", auth, controller.editUser);

router.delete("/profile", auth, controller.deleteUser);

// Convenience proxies so the sub-user dashboard can hit a single base path.
router.get("/profile/activities", auth, activityController.listMine);
router.post("/profile/activities", auth, activityController.createMine);

module.exports = router;
