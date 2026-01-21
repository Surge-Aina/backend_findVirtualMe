const PortfolioEditLog = require('../../models/portfolioLogs/PortfolioEditLog');

/**
 * Create a new portfolio edit log entry
 * @route   POST /api/portfolio-edit-log
 * @access  Public (can be made private with auth middleware if needed)
 */
exports.createLog = async (req, res) => {
  try {
    const {
      userId,
      name,
      email,
      portfolioID,
      portfolioType,
      action,
      sessionId,
      mouseInfo,
      timestamp
    } = req.body;

    // Validate required fields
    if (!userId || !portfolioType) {
      return res.status(400).json({
        message: 'Missing required fields: userId and portfolioType are required'
      });
    }

    // Create new log entry
    const logEntry = new PortfolioEditLog({
      userId,
      name,
      email,
      portfolioID,
      portfolioType,
      action: action || 'created',
      sessionId: sessionId || `session_${Date.now()}`,
      mouseInfo: mouseInfo || [],
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    const savedLog = await logEntry.save();
    
    res.status(201).json({
      success: true,
      message: 'Portfolio edit log created successfully',
      log: savedLog
    });
  } catch (error) {
    console.error('Error creating portfolio edit log:', error);
    res.status(500).json({
      message: 'Error creating portfolio edit log',
      error: error.message
    });
  }
};

/**
 * Get portfolio edit logs by user ID
 * @route   GET /api/portfolio-edit-log/user/:userId
 * @access  Private (should add auth middleware)
 */
exports.getLogsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const logs = await PortfolioEditLog.find({ userId }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching logs by user ID:', error);
    res.status(500).json({
      message: 'Error fetching logs',
      error: error.message
    });
  }
};

/**
 * Get portfolio edit logs by portfolio ID
 * @route   GET /api/portfolio-edit-log/portfolio/:portfolioID
 * @access  Private (should add auth middleware)
 */
exports.getLogsByPortfolioId = async (req, res) => {
  try {
    const { portfolioID } = req.params;
    const logs = await PortfolioEditLog.find({ portfolioID }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching logs by portfolio ID:', error);
    res.status(500).json({
      message: 'Error fetching logs',
      error: error.message
    });
  }
};

/**
 * Get portfolio edit logs by session ID
 * @route   GET /api/portfolio-edit-log/session/:sessionId
 * @access  Private (should add auth middleware)
 */
exports.getLogsBySessionId = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const logs = await PortfolioEditLog.find({ sessionId }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching logs by session ID:', error);
    res.status(500).json({
      message: 'Error fetching logs',
      error: error.message
    });
  }
};

/**
 * Get all portfolio edit logs (with pagination)
 * @route   GET /api/portfolio-edit-log
 * @access  Private (should add auth middleware, typically admin only)
 */
exports.getAllLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const logs = await PortfolioEditLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PortfolioEditLog.countDocuments();

    res.json({
      success: true,
      count: logs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      logs
    });
  } catch (error) {
    console.error('Error fetching all logs:', error);
    res.status(500).json({
      message: 'Error fetching logs',
      error: error.message
    });
  }
};


