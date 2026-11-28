const express = require("express");
const router = express.Router();
const ctrl = require("./accounts.controller");
const auth = require("../../shared/middleware/auth");

router.use(auth);

router.get("/", ctrl.listMine);
router.post("/", ctrl.create);
router.get("/super-admin/all", ctrl.listAllAccountsForSuperAdmin);
router.get("/:accountId/members", ctrl.listMembers);
router.post("/:accountId/members", ctrl.addMember);
router.patch("/:accountId/members/:membershipId", ctrl.updateMember);
router.delete("/:accountId/members/:membershipId", ctrl.removeMember);
router.get("/:accountId/portfolios", ctrl.listAccountPortfolios);

module.exports = router;