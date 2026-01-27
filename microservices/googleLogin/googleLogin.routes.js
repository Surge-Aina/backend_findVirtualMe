const express = require("express");
const router = express.Router();
const { googleLogin } = require("./googleLogin.controller");

router.post("/auth/google", googleLogin);

module.exports = router;
