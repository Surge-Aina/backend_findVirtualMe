const express = require("express");
const auth = require("../../shared/middleware/auth");
const controller = require("./webhooks.controller");

const router = express.Router();

router.use(auth);
router.post("/", controller.create);
router.get("/", controller.list);
router.post("/:id/rotate", controller.rotate);
router.post("/:id/test", controller.test);
router.get("/:id/deliveries", controller.deliveries);
router.delete("/:id", controller.remove);

module.exports = router;
