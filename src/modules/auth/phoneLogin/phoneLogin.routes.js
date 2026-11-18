const express = require("express");
const auth = require("../../../shared/middleware/auth");
const {
  requirePhoneLoginFeature,
  sendRateLimits,
  verifyRateLimits,
} = require("./phoneLogin.middleware");
const {
  startVerify,
  confirmVerify,
  loginStart,
  loginVerify,
  phoneStatus,
} = require("./phoneLogin.controller");

const router = express.Router();

router.use(requirePhoneLoginFeature);

function chain(limiters, handler) {
  const handlers = [...limiters, handler];
  return handlers;
}

router.get("/status", auth, phoneStatus);
router.post("/start-verify", auth, ...chain(sendRateLimits, startVerify));
router.post("/confirm-verify", auth, ...chain(verifyRateLimits, confirmVerify));
router.post("/login/start", ...chain(sendRateLimits, loginStart));
router.post("/login/verify", ...chain(verifyRateLimits, loginVerify));

module.exports = router;