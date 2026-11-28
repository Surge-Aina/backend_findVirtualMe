const express = require("express");
const { patchUserComped } = require("./admin.controller");
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");

const router = express.Router();

router.patch("/users/:id/comped", auth, roleCheck(["admin"]), patchUserComped);

module.exports = router;