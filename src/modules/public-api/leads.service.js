const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const ContactMeForm = require("../contact/contactMeForm.model");
const ProjectManagerContact = require("../../legacy/project-manager/models/ProjectManagerContact");
const DataScientistContact = require("../../legacy/data-scientist/models/DataScientistContact");
const HandymanInquiry = require("../../legacy/handyman/models/handymanInquiryModel");
const { consentFromStored } = require("./leadConsent");

const SOURCES = [
  { form: "contact", model: ContactMeForm, siteField: "portfolioId" },
  { form: "projectManagerContact", model: ProjectManagerContact, siteField: "portfolioId" },
  { form: "dataScientistContact", model: DataScientistContact, siteField: "portfolioId" },
  { form: "handymanInquiry", model: HandymanInquiry, siteField: "portfolioId" },
];

function textOrNull(value) {
  return typeof value === "string" ? value : null;
}

function presentLead(doc, form, siteId) {
  return {
    id: doc._id.toString(),
    siteId: String(siteId),
    form,
    email: textOrNull(doc.email),
    name: textOrNull(doc.name),
    phone: textOrNull(doc.phone),
    message: textOrNull(doc.message),
    consent: consentFromStored(doc.consentContact),
    createdAt: doc.createdAt || null,
  };
}

async function getLead({ ownerId, leadId, siteId }) {
  if (!mongoose.isValidObjectId(leadId) || !mongoose.isValidObjectId(ownerId)) return null;
  if (siteId && !mongoose.isValidObjectId(siteId)) return null;

  for (const source of SOURCES) {
    const doc = await source.model.findById(leadId).lean();
    if (!doc) continue;
    const docSite = doc[source.siteField];
    if (!docSite) return null;
    if (siteId && String(docSite) !== String(siteId)) return null;
    const owned = await Portfolio.findOne({ _id: docSite, owner: ownerId }).select("_id").lean();
    if (!owned) return null;
    return presentLead(doc, source.form, docSite);
  }
  return null;
}

module.exports = {
  getLead,
};
