const promoService = require("./promo.service");

exports.createPromo = async (req, res) => {
  try {
    const result = await promoService.createPromo(req.body, req.user);
    res.json(result);
  } catch (err) {
    const msg = err.message || "Server error";
    const code = msg.includes("Invalid")
      ? 400
      : msg.includes("missing")
      ? 500
      : msg.includes("not found")
      ? 404
      : msg.includes("OpenAI")
      ? 502
      : 500;

    res.status(code).json({ ok: false, error: msg });
  }
};
