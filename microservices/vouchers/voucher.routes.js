const express = require("express");
const router = express.Router();
const controller = require("./voucher.controller");
const auth = require("../../middleware/auth");

/* user routes */
router.get("/my", auth, controller.getMyVouchers);
router.post("/apply-domain", auth, controller.applyDomainVoucher);
router.post("/redeem", auth, controller.redeemVoucher);

/* internal/admin routes */
router.post("/grant", controller.grantVoucher);

module.exports = router;
