const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const PortfolioDraft = require("../portfolios/models/PortfolioDraft");
const portfolioService = require("../portfolios/portfolio.service");
const portfolioDraftService = require("../portfolios/portfolioDraft.service");
const { isUnifiedTemplate } = require("../portfolios/models/componentRegistry");
const { BLOCK_TYPES } = require("../portfolios/models/blockTypes");
const { isSiteDraftsEnabled } = require("../../shared/config/siteDrafts");
const { toPublicSite } = require("./siteView");
const sitesService = require("./sites.service");
const { PlanLimitError } = require("../portfolios/planLimits.service");

class SiteToolsError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "SiteToolsError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const CONTENT_KEYS = [
  "summary",
  "about",
  "experience",
  "skills",
  "projects",
  "education",
  "contact",
  "resumeUrl",
];

function templateSupportsSection(template, blockType) {
  const spec = BLOCK_TYPES[blockType];
  if (!spec || !Array.isArray(spec.templates)) return false;
  return spec.templates.includes(template) || template === "agent";
}

function findSection(sections, types) {
  const list = Array.isArray(types) ? types : [types];
  return (sections || []).find((s) => list.includes(s.type)) || null;
}

function extractContentFromSections(sections, template) {
  const summarySection = findSection(sections, "summary");
  const heroSection = findSection(sections, "hero");
  const payload = {
    summary: null,
    about: null,
    experience: null,
    skills: null,
    projects: null,
    education: null,
    contact: null,
    resumeUrl: null,
  };

  if (summarySection) {
    payload.summary = {
      name: summarySection.data?.name ?? "",
      title: summarySection.data?.title ?? "",
      summary: summarySection.data?.summary ?? "",
      bio: summarySection.data?.bio ?? "",
      email: summarySection.data?.email ?? "",
      phone: summarySection.data?.phone ?? "",
      location: summarySection.data?.location ?? "",
    };
    payload.about = summarySection.data?.bio ?? summarySection.data?.summary ?? "";
    payload.resumeUrl = summarySection.data?.resumeUrl ?? "";
  } else if (heroSection) {
    payload.summary = {
      title: heroSection.data?.title ?? heroSection.data?.practiceName ?? "",
      subtitle: heroSection.data?.subtitle ?? heroSection.data?.tagline ?? "",
    };
    payload.about =
      heroSection.data?.description ??
      heroSection.data?.subtitle ??
      heroSection.data?.tagline ??
      "";
  }

  for (const key of ["experience", "skills", "projects", "education", "contact"]) {
    if (!templateSupportsSection(template, key)) {
      payload[key] = null;
      continue;
    }
    const section = findSection(sections, key);
    payload[key] = section ? { ...section.data } : null;
  }

  if (payload.resumeUrl === null && summarySection?.data?.resumeUrl) {
    payload.resumeUrl = summarySection.data.resumeUrl;
  }

  return payload;
}

async function recordMcpWriteVersion(ownerId, siteId, source) {
  if (source !== "mcp") return null;
  return portfolioDraftService.recordWriteVersion(siteId, ownerId, { source: "ai" });
}

async function assertOwnedSite(ownerId, siteId) {
  if (!mongoose.isValidObjectId(siteId)) {
    throw new SiteToolsError(404, "not_found", "Site not found");
  }
  const owned = await portfolioService.assertPortfolioOwner(siteId, ownerId);
  if (!owned.ok) {
    const status = owned.status === 403 ? 404 : owned.status;
    const code = status === 404 ? "not_found" : "forbidden";
    throw new SiteToolsError(status, code, status === 404 ? "Site not found" : owned.error);
  }
}

async function createSite({ ownerId, template, title }) {
  if (!template || typeof template !== "string") {
    throw new SiteToolsError(400, "validation_error", "template is required", { field: "template" });
  }
  if (!isUnifiedTemplate(template)) {
    throw new SiteToolsError(400, "validation_error", "template is not supported", {
      field: "template",
      allowed: ["projectManager", "dataScientist", "agent", "healthcare", "handyman"],
    });
  }
  try {
    const doc = await portfolioService.createPortfolio(ownerId, template, {
      title: typeof title === "string" ? title : "",
      createdBy: "user",
    });
    const domainMap = await sitesService.loadDomains(ownerId, [doc._id]);
    const site = toPublicSite(
      doc.toObject ? doc.toObject() : doc,
      domainMap.get(String(doc._id)) || []
    );
    return {
      site: {
        ...site,
        template,
        content: extractContentFromSections(doc.sections, template),
      },
    };
  } catch (err) {
    if (err instanceof PlanLimitError || err?.code === "PLAN_LIMIT") {
      throw new SiteToolsError(err.status || 402, err.code, err.message, err.details || {});
    }
    if (err?.name === "PortfolioValidationError") {
      throw new SiteToolsError(400, "validation_error", err.message, err.details || {});
    }
    if (err?.code === 11000) {
      throw new SiteToolsError(409, "conflict", "slug already in use");
    }
    throw err;
  }
}

async function getSiteContent({ ownerId, siteId }) {
  await assertOwnedSite(ownerId, siteId);
  const portfolio = await Portfolio.findOne({ _id: siteId, owner: ownerId })
    .select("template sections title slug visibility themeId themeTokens")
    .lean();
  if (!portfolio) throw new SiteToolsError(404, "not_found", "Site not found");

  let sections = portfolio.sections;
  let draftMode = false;
  let approvalState = "approved";
  let meta = portfolio;

  if (isSiteDraftsEnabled()) {
    const draft = await PortfolioDraft.findOne({ portfolioId: siteId }).lean();
    if (draft) {
      sections = draft.sections;
      draftMode = true;
      approvalState = draft.approvalState || "pending_owner";
      meta = { ...portfolio, ...draft, template: portfolio.template };
    }
  }

  return {
    siteId: String(siteId),
    template: portfolio.template,
    title: meta.title || "",
    slug: meta.slug || "",
    visibility: meta.visibility || portfolio.visibility,
    themeId: meta.themeId || "",
    themeTokens: meta.themeTokens || {},
    draftMode,
    approvalState,
    content: extractContentFromSections(sections, portfolio.template),
  };
}

function mergeContentIntoSection(section, key, value, template) {
  if (!section) return null;
  const data = { ...(section.data || {}) };
  if (key === "resumeUrl") {
    if (section.type !== "summary") return section;
    data.resumeUrl = typeof value === "string" ? value : "";
    section.data = portfolioService.validateSectionData(section.type, data);
    return section;
  }
  if (key === "about") {
    if (section.type === "summary") {
      if (typeof value === "string") data.bio = value;
      section.data = portfolioService.validateSectionData(section.type, data);
      return section;
    }
    if (section.type === "hero") {
      if (typeof value === "string") data.description = value;
      section.data = portfolioService.validateSectionData(section.type, data);
      return section;
    }
    return section;
  }
  if (key === "summary" && section.type === "summary" && value && typeof value === "object") {
    Object.assign(data, value);
    section.data = portfolioService.validateSectionData(section.type, data);
    return section;
  }
  if (key === "summary" && section.type === "hero" && value && typeof value === "object") {
    if (value.title !== undefined) data.title = value.title;
    if (value.subtitle !== undefined) data.subtitle = value.subtitle;
    if (value.practiceName !== undefined) data.practiceName = value.practiceName;
    if (value.tagline !== undefined) data.tagline = value.tagline;
    section.data = portfolioService.validateSectionData(section.type, data);
    return section;
  }
  if (["experience", "skills", "projects", "education", "contact"].includes(key)) {
    if (section.type !== key) return section;
    if (value === null || value === undefined) return section;
    if (typeof value !== "object") {
      throw new SiteToolsError(400, "validation_error", `${key} must be an object`, { field: key });
    }
    const merged = { ...data, ...value };
    section.data = portfolioService.validateSectionData(section.type, merged);
    return section;
  }
  return section;
}

async function updateSiteContent({ ownerId, siteId, content, source = "api" }) {
  await assertOwnedSite(ownerId, siteId);
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new SiteToolsError(400, "validation_error", "content must be an object", { field: "content" });
  }

  const unknown = Object.keys(content).filter((k) => !CONTENT_KEYS.includes(k));
  if (unknown.length > 0) {
    throw new SiteToolsError(400, "validation_error", "Unknown content keys", { fields: unknown });
  }

  const portfolio = await Portfolio.findById(siteId).select("template");
  if (!portfolio) throw new SiteToolsError(404, "not_found", "Site not found");

  const draftSource = source === "mcp" ? "ai" : "api";

  if (isSiteDraftsEnabled()) {
    await portfolioDraftService.ensureDraftForSource(siteId, draftSource);
    const draft = await PortfolioDraft.findOne({ portfolioId: siteId });
    if (!draft) throw new SiteToolsError(500, "internal_error", "Could not load site draft");

    for (const key of Object.keys(content)) {
      if (content[key] === undefined) continue;
      if (key === "resumeUrl") {
        const summary = findSection(draft.sections, "summary");
        if (!summary) {
          throw new SiteToolsError(400, "validation_error", "resumeUrl is not supported for this template", {
            field: "resumeUrl",
          });
        }
        mergeContentIntoSection(summary, key, content[key], portfolio.template);
        continue;
      }
      if (key === "about") {
        const target = findSection(draft.sections, ["summary", "hero"]);
        if (!target) {
          throw new SiteToolsError(400, "validation_error", "about is not supported for this template", {
            field: "about",
          });
        }
        mergeContentIntoSection(target, key, content[key], portfolio.template);
        continue;
      }
      if (key === "summary") {
        const target = findSection(draft.sections, ["summary", "hero"]);
        if (!target) {
          throw new SiteToolsError(400, "validation_error", "summary is not supported for this template", {
            field: "summary",
          });
        }
        mergeContentIntoSection(target, key, content[key], portfolio.template);
        continue;
      }
      if (!templateSupportsSection(portfolio.template, key)) {
        throw new SiteToolsError(400, "validation_error", `${key} is not supported for this template`, {
          field: key,
        });
      }
      const section = findSection(draft.sections, key);
      if (!section) {
        throw new SiteToolsError(400, "validation_error", `${key} section is missing on this site`, { field: key });
      }
      mergeContentIntoSection(section, key, content[key], portfolio.template);
    }

    draft.approvalState = "pending_owner";
    draft.source = draftSource;
    await draft.save();
    const versionNumber = await recordMcpWriteVersion(ownerId, siteId, source);
    const view = await getSiteContent({ ownerId, siteId });
    return versionNumber ? { ...view, versionNumber } : view;
  }

  for (const key of Object.keys(content)) {
    if (content[key] === undefined) continue;
    if (key === "resumeUrl" || key === "about" || key === "summary") {
      const full = await Portfolio.findById(siteId);
      const target = findSection(full.sections, key === "resumeUrl" || key === "about" ? ["summary", "hero"] : ["summary", "hero"]);
      if (!target) {
        throw new SiteToolsError(400, "validation_error", `${key} is not supported for this template`, { field: key });
      }
      const sectionId = target._id.toString();
      const updatedData = mergeContentIntoSection(
        { type: target.type, data: { ...target.data } },
        key,
        content[key],
        portfolio.template
      );
      await portfolioService.updateSection(siteId, sectionId, updatedData.data);
      continue;
    }
    if (!templateSupportsSection(portfolio.template, key)) {
      throw new SiteToolsError(400, "validation_error", `${key} is not supported for this template`, { field: key });
    }
    const full = await Portfolio.findById(siteId);
    const section = findSection(full.sections, key);
    if (!section) {
      throw new SiteToolsError(400, "validation_error", `${key} section is missing on this site`, { field: key });
    }
    const merged = mergeContentIntoSection(
      { type: section.type, data: { ...section.data } },
      key,
      content[key],
      portfolio.template
    );
    await portfolioService.updateSection(siteId, section._id.toString(), merged.data);
  }

  const versionNumber = await recordMcpWriteVersion(ownerId, siteId, source);
  const view = await getSiteContent({ ownerId, siteId });
  return versionNumber ? { ...view, versionNumber } : view;
}

async function updateSiteSettings({ ownerId, siteId, settings, source = "api" }) {
  await assertOwnedSite(ownerId, siteId);
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new SiteToolsError(400, "validation_error", "settings must be an object", { field: "settings" });
  }

  const allowed = ["title", "slug", "visibility", "themeId", "themeTokens"];
  const unknown = Object.keys(settings).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    throw new SiteToolsError(400, "validation_error", "Unknown settings keys", { fields: unknown });
  }

  if (settings.slug !== undefined) {
    const slug = String(settings.slug).trim().toLowerCase();
    if (!slug) {
      throw new SiteToolsError(400, "validation_error", "slug cannot be empty", { field: "slug" });
    }
    const clash = await Portfolio.findOne({ slug, _id: { $ne: siteId } }).select("_id").lean();
    if (clash) {
      throw new SiteToolsError(409, "conflict", "slug already in use", { field: "slug" });
    }
    settings.slug = slug;
  }

  if (settings.visibility !== undefined && !["public", "private"].includes(settings.visibility)) {
    throw new SiteToolsError(400, "validation_error", "visibility must be public or private", {
      field: "visibility",
    });
  }

  const draftSource = source === "mcp" ? "ai" : "api";
  if (isSiteDraftsEnabled()) {
    await portfolioDraftService.ensureDraftForSource(siteId, draftSource);
  }

  try {
  await portfolioService.updatePortfolio(siteId, settings);
  } catch (err) {
    if (err?.name === "PortfolioValidationError") {
      throw new SiteToolsError(400, "validation_error", err.message, err.details || {});
    }
    if (err?.code === 11000) {
      throw new SiteToolsError(409, "conflict", "slug already in use", { field: "slug" });
    }
    throw err;
  }

  const versionNumber = await recordMcpWriteVersion(ownerId, siteId, source);
  const view = await getSiteContent({ ownerId, siteId });
  return versionNumber ? { ...view, versionNumber } : view;
}

async function submitForPublish({ ownerId, siteId, source = "api" }) {
  await assertOwnedSite(ownerId, siteId);
  if (!isSiteDraftsEnabled()) {
    return {
      siteId: String(siteId),
      submitted: false,
      draftMode: false,
      approvalState: "not_required",
      message: "Site drafts are disabled; changes apply directly to the live site.",
    };
  }
  const draftSource = source === "mcp" ? "ai" : "api";
  await portfolioDraftService.ensureDraftForSource(siteId, draftSource);
  const draft = await PortfolioDraft.findOne({ portfolioId: siteId });
  if (!draft) throw new SiteToolsError(500, "internal_error", "Could not load site draft");
  draft.approvalState = "pending_owner";
  draft.source = draftSource;
  await draft.save();
  return {
    siteId: String(siteId),
    submitted: true,
    draftMode: true,
    approvalState: draft.approvalState,
  };
}

async function listSiteVersions({ ownerId, siteId }) {
  await assertOwnedSite(ownerId, siteId);
  const versions = await portfolioDraftService.listVersions(siteId);
  return {
    siteId: String(siteId),
    versions,
  };
}

async function revertSiteVersion({ ownerId, siteId, versionNumber }) {
  await assertOwnedSite(ownerId, siteId);
  const parsed = Number(versionNumber);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new SiteToolsError(400, "validation_error", "versionNumber must be a positive integer", {
      field: "versionNumber",
    });
  }
  const result = await portfolioDraftService.revertVersionToDraft(siteId, parsed);
  if (!result) {
    throw new SiteToolsError(404, "not_found", "Version not found");
  }
  return {
    siteId: String(siteId),
    revertedFromVersion: result.revertedFromVersion,
    approvalState: result.draft?.approvalState || "pending_owner",
    note: result.note,
  };
}

async function publishSite({ ownerId, siteId }) {
  await assertOwnedSite(ownerId, siteId);
  if (isSiteDraftsEnabled()) {
    const result = await portfolioDraftService.publishDraft(siteId, ownerId);
    if (!result) throw new SiteToolsError(404, "not_found", "Site not found");
    return {
      siteId: String(siteId),
      published: true,
      versionNumber: result.versionNumber,
      visibility: result.portfolio.visibility,
    };
  }
  const updated = await portfolioService.updatePortfolio(siteId, { visibility: "public" });
  if (!updated) throw new SiteToolsError(404, "not_found", "Site not found");
  return {
    siteId: String(siteId),
    published: true,
    visibility: updated.visibility || "public",
  };
}

module.exports = {
  SiteToolsError,
  CONTENT_KEYS,
  createSite,
  getSiteContent,
  updateSiteContent,
  updateSiteSettings,
  submitForPublish,
  publishSite,
  listSiteVersions,
  revertSiteVersion,
  extractContentFromSections,
};