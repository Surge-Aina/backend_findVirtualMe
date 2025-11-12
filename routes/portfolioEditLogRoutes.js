const express = require('express');
const router = express.Router();
const {
  createLog,
  getLogsByUserId,
  getLogsByPortfolioId,
  getLogsBySessionId,
  getAllLogs
} = require("../controllers/portfolioEditLog/portfolioEditLogController");
// Optional: Add auth middleware if needed
// const auth = require('../middleware/auth');

// POST /api/portfolio-edit-log - Create a new log entry
router.post('/', createLog);

// GET /api/portfolio-edit-log - Get all logs (with pagination)
router.get('/', getAllLogs);

// GET /api/portfolio-edit-log/user/:userId - Get logs by user ID
router.get('/user/:userId', getLogsByUserId);

// GET /api/portfolio-edit-log/portfolio/:portfolioID - Get logs by portfolio ID
router.get('/portfolio/:portfolioID', getLogsByPortfolioId);

// GET /api/portfolio-edit-log/session/:sessionId - Get logs by session ID
router.get('/session/:sessionId', getLogsBySessionId);

module.exports = router;


