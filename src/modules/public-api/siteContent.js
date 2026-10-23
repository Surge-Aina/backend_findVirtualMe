const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const { buildBusinessProfile, publishedContact } = require("./businessProfile");
const { notifyBusinessProfileUpdated } = require("./lifecycleEvents");

const SECTION_FIELDS = Object.freeze({
  hero: ["practiceName", "businessName", "companyName", "tagline", "headline", "subtitle"],
  summary: ["name", "headline", "title", "bio", "about", "description"],
});

class SiteContentError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "SiteContentError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function cleanCopy(value) {
  if (typeof value !== "string") {
    throw new SiteContentError(400, "validation_error", "value must be a string", { field: "value" });
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 200 || /[\u0000-\u001F\u007F<>]/.test(trimmed)) {
    throw new SiteContentError(400, "validation_error", "value is invalid", { field: "value" });
  }
  if (trimmed.includes("@") || /https?:\/\//i.test(trimmed) || /^\+?[\d().\-\s]{7,}$/.test(trimmed)) {
    throw new SiteContentError(400, "validation_error", "value cannot include contact details or links", {
      field: "value",
    });
  }
  return trimmed;
}

function emitIfChanged(before, after) {
  if (!after || !after.owner) return;
  const prev = {
    profile: buildBusinessProfile(before),
    contact: publishedContact(before),
  };
  const next = {
    profile: buildBusinessProfile(after),
    contact: publishedContact(after),
  };
  if (JSON.stringify(prev) === JSON.stringify(next)) return;
  notifyBusinessProfileUpdated({
    ownerId: after.owner,
    siteId: after._id,
    profile: next.profile,
    contact: next.contact,
    updatedAt: new Date(),
  });
}

async function updateSiteContent({ ownerId, siteId, field, value, sectionId }) {
  if (!mongoose.isValidObjectId(siteId)) {
    throw new SiteContentError(404, "not_found", "Site not found");
  }
  const portfolio = await Portfolio.findOne({ _id: siteId, owner: ownerId });
  if (!portfolio) throw new SiteContentError(404, "not_found", "Site not found");
  const cleaned = cleanCopy(value);
  const before = portfolio.toObject();

  if (field === "title" && (sectionId === undefined || sectionId === null || sectionId === "")) {
    portfolio.title = cleaned;
    const saved = await portfolio.save();
    emitIfChanged(before, saved.toObject());
    return { siteId: saved._id.toString(), field: "title", value: cleaned };
  }

  if (!mongoose.isValidObjectId(sectionId)) {
    throw new SiteContentError(400, "validation_error", "sectionId is required for this field", {
      field: "sectionId",
    });
  }
  const section = portfolio.sections.id(sectionId);
  if (!section) throw new SiteContentError(404, "not_found", "Section not found");
  const allowed = SECTION_FIELDS[section.type] || [];
  if (!allowed.includes(field)) {
    throw new SiteContentError(400, "validation_error", "field cannot be changed", { field: "field" });
  }
  const data = section.data && typeof section.data === "object" ? { ...section.data } : {};
  data[field] = cleaned;
  section.data = data;
  section.markModified("data");
  const saved = await portfolio.save();
  emitIfChanged(before, saved.toObject());
  return { siteId: saved._id.toString(), sectionId: String(sectionId), field, value: cleaned };
}

module.exports = {
  SiteContentError,
  SECTION_FIELDS,
  updateSiteContent,
};
