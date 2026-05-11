const TermsOfService = require("./termsOfService.model");
const mongoose = require("mongoose");

function normalizePortfolioRefs(portfolios = []) {
  return (Array.isArray(portfolios) ? portfolios : [])
    .map((p) => {
      if (!p?.id || !p?.type) return null;
      let id = p.id;
      try {
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

async function detachPortfoliosFromOtherTerms(ownerId, keepTermsId, portfolios) {
  const refs = normalizePortfolioRefs(portfolios);
  if (refs.length === 0) return;

  await TermsOfService.updateMany(
    { ownerId, _id: { $ne: keepTermsId } },
    {
      $pull: {
        portfolios: {
          $or: refs,
        },
      },
    },
  );
}

exports.termsOfServiceService = {
  async getById(id, ownerId) {
    return TermsOfService.findOne({ _id: id, ownerId });
  },

  async getByOwner(ownerId) {
    return TermsOfService.find({ ownerId });
  },

  async getPublicByPortfolio(portfolio) {
    const filter = {
      "portfolios.id": portfolio.id,
      "portfolios.type": portfolio.type,
    };
    return TermsOfService.findOne(filter);
  },

  async create(data, ownerId) {
    const doc = new TermsOfService({ ...data, ownerId });
    const saved = await doc.save();
    await detachPortfoliosFromOtherTerms(ownerId, saved._id, saved.portfolios);
    return saved;
  },

  async update(id, ownerId, updates) {
    const updated = await TermsOfService.findOneAndUpdate(
      { _id: id, ownerId },
      updates,
      { new: true },
    );
    if (updated) {
      await detachPortfoliosFromOtherTerms(ownerId, updated._id, updated.portfolios);
    }
    return updated;
  },

  async remove(id, ownerId) {
    return TermsOfService.findOneAndDelete({ _id: id, ownerId });
  },
};
