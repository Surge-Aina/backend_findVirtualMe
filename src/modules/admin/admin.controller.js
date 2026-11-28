const mongoose = require("mongoose");
const User = require("../../shared/models/User");

const VALID_COMPED_PLANS = new Set(["basic", "pro"]);

exports.patchUserComped = async (req, res) => {
  try {
    const targetId = String(req.params.id || "");
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(404).json({ message: "User not found" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { comped, compedPlan } = body;

    if (typeof comped !== "boolean") {
      return res.status(400).json({ message: "comped must be a boolean" });
    }

    let nextPlan = null;
    if (compedPlan !== undefined && compedPlan !== null) {
      const normalized = String(compedPlan).trim().toLowerCase();
      if (!VALID_COMPED_PLANS.has(normalized)) {
        return res.status(400).json({ message: "compedPlan must be basic, pro, or null" });
      }
      nextPlan = normalized;
    }

    if (!comped) {
      nextPlan = null;
    }

    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: { comped, compedPlan: nextPlan } },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`[COMPED-AUDIT] userId=${String(user._id)}`);

    res.status(200).json({
      userId: String(user._id),
      comped: Boolean(user.comped),
      compedPlan: user.compedPlan ?? null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};