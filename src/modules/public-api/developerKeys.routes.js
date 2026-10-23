const express = require("express");
const auth = require("../../shared/middleware/auth");
const controller = require("./developerKeys.controller");

const router = express.Router();

// Session auth only. API keys cannot mint, list, or revoke keys.
router.use(auth);
router.post("/", controller.create);
router.get("/", controller.list);
router.delete("/:id", controller.revoke);
router.post("/:id/rotate", controller.rotate);

module.exports = router;
