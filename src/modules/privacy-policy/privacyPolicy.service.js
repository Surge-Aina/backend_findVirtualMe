const PrivacyPolicy = require("./privacyPolicy.model");
const mongoose = require("mongoose");

function normalizePortfolioRefs(portfolios = []) {
  return (Array.isArray(portfolios) ? portfolios : [])
    .map((p) => {
      if (!p?.id || !p?.type) return null;
      let id = p.id;
      try {
        // ensure query casting matches stored ObjectId
        id = mongoose.Types.ObjectId.isValid(p.id)
          ? new mongoose.Types.ObjectId(p.id)
          : p.id;
      } catch {
        // fall back to original
      }
      return { id, type: p.type };
    })
    .filter(Boolean);
}

async function detachPortfoliosFromOtherPolicies(ownerId, keepPolicyId, portfolios) {
  const refs = normalizePortfolioRefs(portfolios);
  if (refs.length === 0) return;

  await PrivacyPolicy.updateMany(
    { ownerId, _id: { $ne: keepPolicyId } },
    {
      $pull: {
        portfolios: {
          $or: refs,
        },
      },
    },
  );
}

exports.privacyPolicyService = {
  async getById(id, ownerId) {
    return PrivacyPolicy.findOne({ _id: id, ownerId });
  },

  async getByOwner(ownerId) {
    return PrivacyPolicy.find({ ownerId });
  },

  async getPublicByPortfolio(portfolio) {
    const filter = {
      "portfolios.id": portfolio.id,
      "portfolios.type": portfolio.type,
    };
    return PrivacyPolicy.findOne(filter);
  },

  async create(data, ownerId) {
    const doc = new PrivacyPolicy({ ...data, ownerId });
    const saved = await doc.save();
    await detachPortfoliosFromOtherPolicies(ownerId, saved._id, saved.portfolios);
    return saved;
  },

  async update(id, ownerId, updates) {
    const updated = await PrivacyPolicy.findOneAndUpdate(
      { _id: id, ownerId },
      updates,
      { new: true },
    );
    if (updated) {
      await detachPortfoliosFromOtherPolicies(ownerId, updated._id, updated.portfolios);
    }
    return updated;
  },

  async remove(id, ownerId) {
    return PrivacyPolicy.findOneAndDelete({ _id: id, ownerId });
  },
};

