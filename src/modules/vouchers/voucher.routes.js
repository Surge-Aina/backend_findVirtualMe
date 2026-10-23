const express = require("express");
const router = express.Router();
const controller = require("./voucher.controller");
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");

/* user routes */
router.get("/my", auth, controller.getMyVouchers);
router.post("/apply-domain", auth, controller.applyDomainVoucher);
router.post("/redeem", auth, controller.redeemVoucher);

/* Stripe webhooks grant through the service. HTTP grant is admin-only. */
router.post("/grant", auth, roleCheck(["admin"]), controller.grantVoucher);

module.exports = router;
