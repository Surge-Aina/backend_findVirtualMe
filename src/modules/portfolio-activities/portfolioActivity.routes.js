const express = require("express");
const router = express.Router();
const controller = require("./portfolioActivity.controller");
const subUserAuth = require("../auth/guestLogin/auth");
const ownerAuth = require("../../shared/middleware/auth");

router.get("/mine", subUserAuth, controller.listMine);
router.post("/", subUserAuth, controller.createMine);
router.patch("/:id/cancel", subUserAuth, controller.cancelMine);

router.get("/", ownerAuth, controller.listAsOwner);
router.post("/admin", ownerAuth, controller.createAsOwner);
router.patch("/:id", ownerAuth, controller.updateAsOwner);

module.exports = router;
