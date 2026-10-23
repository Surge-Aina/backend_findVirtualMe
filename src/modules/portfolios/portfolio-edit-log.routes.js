const express = require('express');
const router = express.Router();
const {
  createLog,
  getLogsByUserId,
  getLogsByPortfolioId,
  getLogsBySessionId,
  getAllLogs
} = require("./portfolio-edit-log/portfolioEditLog.controller");
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");

const adminOnly = [auth, roleCheck(["admin"])];

// POST stays reachable without a session: onboarding logs edits before login.
// Reads include emails and are admin-only.
router.post('/', createLog);

router.get('/', ...adminOnly, getAllLogs);
router.get('/user/:userId', ...adminOnly, getLogsByUserId);
router.get('/portfolio/:portfolioID', ...adminOnly, getLogsByPortfolioId);
router.get('/session/:sessionId', ...adminOnly, getLogsBySessionId);

module.exports = router;


