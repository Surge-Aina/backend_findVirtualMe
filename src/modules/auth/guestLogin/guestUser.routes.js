const express = require("express");
const router = express.Router();
const controller = require("./guestUser.controller");
const auth = require("./auth");

router.post("/login", controller.loginUser);
router.post("/signup", controller.signupUser);

router.patch("/editProfile", auth, controller.editUser);

router.delete("/deleteProfile", auth, controller.deleteUser);

module.exports = router;
