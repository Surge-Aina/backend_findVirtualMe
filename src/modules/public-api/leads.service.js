const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const Contact = require("../contact/contactMeForm.model");
const { encodeCursor, decodeCursor } = require("./cursor");

async function listLeads({ ownerId, limit, cursor }) {
  const sites = await Portfolio.find({ owner: ownerId }).select("_id").lean();
  const ids = sites.map((site) => site._id);
  const filter = { portfolioId: { $in: ids } };
  const cursorId = decodeCursor(cursor);
  if (cursor && !cursorId) return { leads: [], hasMore: false, nextCursor: null };
  if (cursorId) filter._id = { $lt: cursorId };

  const docs = await Contact.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select("portfolioId name email message createdAt")
    .lean();
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  return {
    leads: page.map((doc) => ({
      id: doc._id.toString(),
      siteId: doc.portfolioId.toString(),
      name: doc.name || null,
      email: doc.email || null,
      message: doc.message || null,
      createdAt: doc.createdAt,
    })),
    hasMore,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]._id) : null,
  };
}

function assertOwner(ownerId) {
  if (!mongoose.isValidObjectId(ownerId)) return false;
  return true;
}

module.exports = {
  listLeads,
  assertOwner,
};
