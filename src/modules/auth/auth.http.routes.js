const express = require("express");
const { loginUser, signupUser } = require("./auth.controller");
const { googleLogin } = require("./googleLogin/googleLogin.controller");
const passwordResetRoutes = require("./passwordReset/passwordReset.routes");

const router = express.Router();

router.post("/login", loginUser);
router.post("/signup", signupUser);
router.post("/google", googleLogin);
router.use(passwordResetRoutes);

module.exports = router;
