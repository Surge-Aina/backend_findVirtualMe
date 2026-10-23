const express = require("express");
const auth = require("../../shared/middleware/auth");
const controller = require("./webhooks.controller");

const router = express.Router();

router.use(auth);
router.post("/", controller.create);
router.get("/", controller.list);
router.delete("/:id", controller.remove);

module.exports = router;
