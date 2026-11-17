const { verifyHandoffToken, handoffEnabled } = require("./bagglemeHandoff.service");

exports.bagglemeHandoff = async (req, res, next) => {
  if (!handoffEnabled()) {
    return next();
  }

  try {
    const { token } = req.body || {};
    const payload = await verifyHandoffToken(token);
    return res.status(200).json(payload);
  } catch (err) {
    const code = err && err.code;
    if (code && code !== "handoff_disabled") {
      console.error("baggleme_handoff", code);
    }
    return res.status(401).json({ message: "Invalid handoff" });
  }
};