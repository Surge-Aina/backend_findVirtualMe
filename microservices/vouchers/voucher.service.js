const { Voucher } = require("./voucher.model");
const { UserVoucher } = require("./userVoucher.model");

/**
 * Grant voucher if user qualifies
 */
exports.grantVoucher = async ({ userId, trigger, metadata = {} }) => {
  const voucher = await Voucher.findOne({ autoGrantOn: trigger });

  if (!voucher) return null;

  try {
    const userVoucher = await UserVoucher.create({
      userId,
      voucherId: voucher._id,
      metadata,
    });

    return userVoucher;
  } catch (err) {
    // duplicate voucher prevented by unique index
    if (err.code === 11000) return null;
    throw err;
  }
};


/**
 * Get active vouchers for user
 */
exports.getActiveVouchers = async (userId) => {
  return UserVoucher.find({
    userId,
    status: "active"
  }).populate("voucherId");
};


/**
 * Apply best voucher for domain purchase
 */
exports.applyDomainVoucher = async (userId, price) => {
  const vouchers = await UserVoucher.find({
    userId,
    status: "active"
  }).populate("voucherId");

  if (!vouchers.length) {
    return { finalPrice: price, voucher: null };
  }

  // prioritize highest discount
  let bestVoucher = null;
  let bestDiscount = 0;

  for (const v of vouchers) {
    const def = v.voucherId;
    if (!def) continue;

    let discount = 0;

    if (def.discountAmount)
      discount = def.discountAmount;

    if (def.discountPercentage)
      discount = price * (def.discountPercentage / 100);

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestVoucher = v;
    }
  }

  if (!bestVoucher) return { finalPrice: price, voucher: null };

  const finalPrice = Math.max(0, price - bestDiscount);

  return {
    finalPrice,
    voucher: bestVoucher
  };
};


/**
 * Mark voucher redeemed
 */
exports.redeemVoucher = async (userVoucherId) => {
  return UserVoucher.findByIdAndUpdate(
    userVoucherId,
    {
      status: "redeemed",
      redeemedAt: new Date()
    },
    { new: true }
  );
};
