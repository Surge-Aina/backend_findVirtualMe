const express = require("express");
const router = express.Router();
const ctrl = require("./accounts.controller");
const auth = require("../../shared/middleware/auth");
const {
  validateAccountIdParam,
  validateMembershipIdParam,
} = require("./validateAccountId.middleware");

router.use(auth);

router.get("/", ctrl.listMine);
router.post("/", ctrl.create);
router.get("/super-admin/all", ctrl.listAllAccountsForSuperAdmin);
router.get("/:accountId/members", validateAccountIdParam, ctrl.listMembers);
router.post("/:accountId/members", validateAccountIdParam, ctrl.addMember);
router.patch(
  "/:accountId/members/:membershipId",
  validateAccountIdParam,
  validateMembershipIdParam,
  ctrl.updateMember
);
router.delete(
  "/:accountId/members/:membershipId",
  validateAccountIdParam,
  validateMembershipIdParam,
  ctrl.removeMember
);
router.get("/:accountId/portfolios", validateAccountIdParam, ctrl.listAccountPortfolios);

module.exports = router;