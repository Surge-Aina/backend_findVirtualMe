function httpErrorHandler(err, req, res, next) {
  if (!err) return next();
  const message = String(err.message || "");
  if (
    message === "Not allowed by CORS" ||
    message === "Invalid origin" ||
    message === "CORS validation failed"
  ) {
    return res.status(403).json({
      error: { code: "origin_not_allowed", message: "Origin not allowed" },
    });
  }
  if (res.headersSent) return next(err);

  const status = err.status ?? err.statusCode;
  if (typeof status === "number" && status >= 400 && status < 600) {
    const code =
      status === 413 ? "payload_too_large" : status === 400 ? "bad_request" : "request_error";
    return res.status(status).json({
      error: { code, message: message || "Request failed" },
    });
  }

  console.error("unhandled_error", message);
  return res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
}

module.exports = httpErrorHandler;