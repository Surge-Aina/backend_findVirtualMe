const voucherService = require("./voucher.service");


/**
 * GET /vouchers/my
 */
exports.getMyVouchers = async (req, res) => {
  try {
    const vouchers = await voucherService.getActiveVouchers(req.user._id);
    res.json(vouchers);
  } catch (err) {
    console.error("Get vouchers error:", err);
    res.status(500).json({ message: "Failed to fetch vouchers" });
  }
};


/**
 * POST /vouchers/grant
 * internal use only (webhooks, admin, etc.)
 */
exports.grantVoucher = async (req, res) => {
  try {
    const { userId, trigger, metadata } = req.body;

    const result = await voucherService.grantVoucher({
      userId,
      trigger,
      metadata
    });

    res.json(result);
  } catch (err) {
    console.error("Grant voucher error:", err);
    res.status(500).json({ message: "Failed to grant voucher" });
  }
};


/**
 * POST /vouchers/apply-domain
 */
exports.applyDomainVoucher = async (req, res) => {
  try {
    const { price } = req.body;

    const result = await voucherService.applyDomainVoucher(
      req.user._id,
      price
    );

    res.json(result);
  } catch (err) {
    console.error("Apply voucher error:", err);
    res.status(500).json({ message: "Failed to apply voucher" });
  }
};


/**
 * POST /vouchers/redeem
 */
exports.redeemVoucher = async (req, res) => {
  try {
    const { userVoucherId } = req.body;

    const updated = await voucherService.redeemVoucher(userVoucherId);

    res.json(updated);
  } catch (err) {
    console.error("Redeem voucher error:", err);
    res.status(500).json({ message: "Failed to redeem voucher" });
  }
};
