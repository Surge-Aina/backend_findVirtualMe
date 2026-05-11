const service = require("./portfolioActivity.service");

function sendError(res, err, fallback) {
  if (err && err.status) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code || "ACTIVITY_ERROR",
    });
  }
  console.error("[portfolio-activities] unexpected error:", err);
  return res.status(500).json({ error: fallback });
}

exports.createMine = async (req, res) => {
  try {
    const result = await service.createByPortfolioUser(req.user, req.body || {});
    res.status(201).json({ activity: result });
  } catch (err) {
    sendError(res, err, "Failed to create activity");
  }
};

exports.listMine = async (req, res) => {
  try {
    const docs = await service.listForPortfolioUser(req.user, req.query || {});
    res.json({ activities: docs });
  } catch (err) {
    sendError(res, err, "Failed to fetch activities");
  }
};

exports.cancelMine = async (req, res) => {
  try {
    const doc = await service.cancelByPortfolioUser(req.user, req.params.id);
    res.json({ activity: doc });
  } catch (err) {
    sendError(res, err, "Failed to cancel activity");
  }
};

exports.listAsOwner = async (req, res) => {
  try {
    const ownerUserId = req.user?._id || req.user?.id;
    const docs = await service.listForOwner(ownerUserId, req.query || {});
    res.json({ activities: docs });
  } catch (err) {
    sendError(res, err, "Failed to fetch activities");
  }
};

exports.createAsOwner = async (req, res) => {
  try {
    const ownerUserId = req.user?._id || req.user?.id;
    const doc = await service.createByOwner(ownerUserId, req.body || {});
    res.status(201).json({ activity: doc });
  } catch (err) {
    sendError(res, err, "Failed to create activity");
  }
};

exports.updateAsOwner = async (req, res) => {
  try {
    const ownerUserId = req.user?._id || req.user?.id;
    const doc = await service.updateByOwner(ownerUserId, req.params.id, req.body || {});
    res.json({ activity: doc });
  } catch (err) {
    sendError(res, err, "Failed to update activity");
  }
};
