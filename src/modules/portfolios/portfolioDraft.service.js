const Portfolio = require("./models/Portfolio");
const PortfolioDraft = require("./models/PortfolioDraft");
const PortfolioVersion = require("./models/PortfolioVersion");
const { notifySitePublished, notifyBusinessProfileUpdated } = require("../public-api/lifecycleEvents");
const MAX_VERSIONS_PER_SITE = 20;

function portfolioService() {
  return require("./portfolio.service");
}

function ps() {
  return portfolioService();
}

const CLIENT_BLOCKED_DRAFT_KEYS = ["source", "approvalState", "externalRef"];

const EDITABLE_KEYS = [
  "title",
  "slug",
  "visibility",
  "hideBranding",
  "socialLinks",
  "sections",
  "themeId",
  "themeTokens",
  "layoutMode",
  "pageBannerDefaults",
  "navBrand",
  "subUserSettings",
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function sectionIdStr(section) {
  return section?._id?.toString?.() || "";
}

function extractSnapshotFromDoc(doc) {
  const plain = ps().plainPortfolio(doc);
  if (!plain) return null;
  return {
    title: plain.title || "",
    slug: plain.slug || "",
    visibility: plain.visibility || "private",
    hideBranding: Boolean(plain.hideBranding),
    socialLinks: cloneJson(plain.socialLinks),
    themeId: plain.themeId || "",
    themeTokens: cloneJson(plain.themeTokens),
    layoutMode: plain.layoutMode || "auto",
    pageBannerDefaults: cloneJson(plain.pageBannerDefaults),
    navBrand: cloneJson(plain.navBrand),
    subUserSettings: cloneJson(plain.subUserSettings),
    sections: (plain.sections || []).map((s) => ({
      _id: s._id,
      type: s.type,
      order: s.order,
      visible: s.visible !== false,
      data: cloneJson(s.data),
    })),
  };
}

function draftToOwnerView(draft) {
  if (!draft) return null;
  const plain = ps().plainPortfolio(draft);
  return {
    portfolioId: plain.portfolioId,
    source: plain.source,
    approvalState: plain.approvalState,
    externalRef: plain.externalRef || {},
    title: plain.title,
    slug: plain.slug,
    visibility: plain.visibility,
    hideBranding: plain.hideBranding,
    socialLinks: plain.socialLinks,
    themeId: plain.themeId,
    themeTokens: plain.themeTokens,
    layoutMode: plain.layoutMode,
    pageBannerDefaults: plain.pageBannerDefaults,
    navBrand: plain.navBrand,
    subUserSettings: plain.subUserSettings,
    sections: plain.sections,
    updatedAt: plain.updatedAt,
    createdAt: plain.createdAt,
  };
}

function emitProfileChangeFromPublish(before, after) {
  const svc = ps();
  const nextDoc = svc.plainPortfolio(after);
  if (!nextDoc || !nextDoc.owner) return;
  const prev = svc.profileSnapshot(before);
  const next = svc.profileSnapshot(nextDoc);
  if (JSON.stringify(prev) === JSON.stringify(next)) return;
  notifyBusinessProfileUpdated({
    ownerId: nextDoc.owner,
    siteId: nextDoc._id,
    profile: next.profile,
    contact: next.contact,
    updatedAt: new Date(),
  });
}

async function getPublishedPortfolio(portfolioId) {
  return Portfolio.findById(portfolioId).lean();
}

async function ensureDraft(portfolioId, { source = "owner" } = {}) {
  let draft = await PortfolioDraft.findOne({ portfolioId });
  if (draft) return draft;

  const published = await Portfolio.findById(portfolioId);
  if (!published) return null;

  const snap = extractSnapshotFromDoc(published);
  draft = new PortfolioDraft({
    portfolioId,
    source,
    approvalState: "pending_owner",
    ...snap,
    sections: snap.sections.map((s) => ({
      _id: s._id,
      type: s.type,
      order: s.order,
      visible: s.visible,
      data: s.data,
    })),
  });
  try {
    await draft.save();
    return draft;
  } catch (err) {
    if (err.code === 11000) {
      const existing = await PortfolioDraft.findOne({ portfolioId });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Ensures a draft exists and stamps external (AI/API) write metadata.
 */
async function ensureDraftForSource(portfolioId, source) {
  if (!["ai", "api"].includes(source)) {
    return ensureDraft(portfolioId, { source: "owner" });
  }
  let draft = await PortfolioDraft.findOne({ portfolioId });
  if (draft) {
    draft.source = source;
    draft.approvalState = "pending_owner";
    await draft.save();
    return draft;
  }

  const created = await ensureDraft(portfolioId, { source });
  if (created && created.source !== source) {
    created.source = source;
    created.approvalState = "pending_owner";
    await created.save();
  }
  return created;
}

async function applyExternalDraftSource(draft, source) {
  if (!draft || !["ai", "api"].includes(source)) return draft;
  if (draft.source !== source || draft.approvalState !== "pending_owner") {
    draft.source = source;
    draft.approvalState = "pending_owner";
    await draft.save();
  }
  return draft;
}

async function deleteDraftAndVersionsForSite(portfolioId) {
  await Promise.all([
    PortfolioDraft.deleteMany({ portfolioId }),
    PortfolioVersion.deleteMany({ portfolioId }),
  ]);
}

const MAX_PUBLISH_VERSION_RETRIES = 8;

async function insertVersionRecord(portfolioId, ownerId, draft, versionSnapshot) {
  for (let attempt = 0; attempt < MAX_PUBLISH_VERSION_RETRIES; attempt += 1) {
    const versionNumber = await getNextVersionNumber(portfolioId);
    try {
      await PortfolioVersion.create({
        portfolioId,
        versionNumber,
        publishedAt: new Date(),
        publishedBy: ownerId,
        source: draft.source || "owner",
        snapshot: versionSnapshot,
      });
      return versionNumber;
    } catch (err) {
      if (err.code === 11000 && attempt < MAX_PUBLISH_VERSION_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unable to allocate version number");
}

async function buildSanitizedUpdate(portfolioId, updates, template) {
  const sanitized = {};
  for (const key of EDITABLE_KEYS) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  const svc = ps();

  if (sanitized.subUserSettings !== undefined) {
    sanitized.subUserSettings = svc.normalizeSubUserSettings(sanitized.subUserSettings);
  }

  if (sanitized.sections !== undefined) {
    sanitized.sections = svc.normalizeSections(sanitized.sections, {
      template,
      requestedCapability: updates.requestedCapability,
      allowEmpty: true,
    });
  }

  if (sanitized.themeId !== undefined) {
    sanitized.themeId = svc.normalizeThemeId(sanitized.themeId, template);
  }
  if (sanitized.themeTokens !== undefined) {
    sanitized.themeTokens = svc.normalizeThemeTokens(sanitized.themeTokens);
  }
  if (sanitized.layoutMode !== undefined) {
    sanitized.layoutMode = svc.normalizeLayoutMode(sanitized.layoutMode, template);
  }
  if (sanitized.pageBannerDefaults !== undefined) {
    sanitized.pageBannerDefaults = svc.normalizePageBannerDefaults(sanitized.pageBannerDefaults);
  }
  if (sanitized.navBrand !== undefined) {
    sanitized.navBrand = svc.normalizeNavBrand(sanitized.navBrand);
  }

  return sanitized;
}

async function applySanitizedToDraft(draft, sanitized) {
  for (const [key, value] of Object.entries(sanitized)) {
    draft.set(key, value);
  }
  draft.source = draft.source || "owner";
  draft.approvalState = "pending_owner";
  return draft.save();
}

function rejectClientDraftMetadata(updates) {
  for (const blocked of CLIENT_BLOCKED_DRAFT_KEYS) {
    if (updates[blocked] !== undefined) {
      const { PortfolioValidationError } = ps();
      throw new PortfolioValidationError(`Cannot set ${blocked} via portfolio update`, {
        code: "READ_ONLY_DRAFT_FIELD",
        details: { field: blocked },
      });
    }
  }
}

async function updateDraftPortfolio(portfolioId, updates) {
  const published = await Portfolio.findById(portfolioId).select("template owner");
  if (!published) return null;

  rejectClientDraftMetadata(updates);

  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const sanitized = await buildSanitizedUpdate(portfolioId, updates, published.template);
  await applySanitizedToDraft(draft, sanitized);
  return PortfolioDraft.findOne({ portfolioId });
}

async function updateDraftSection(portfolioId, sectionId, data) {
  const published = await Portfolio.findById(portfolioId).select("template");
  if (!published) return null;

  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const section = draft.sections.id(sectionId);
  if (!section) return null;

  section.data = ps().validateSectionData(section.type, data);
  draft.approvalState = "pending_owner";
  return draft.save();
}

async function addDraftSection(portfolioId, blockType, data, order, options = {}) {
  const portfolio = await Portfolio.findById(portfolioId).select("template");
  if (!portfolio) return null;

  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const nextOrder =
    order === undefined || order === null
      ? draft.sections.reduce((max, s) => Math.max(max, s.order), -1) + 1
      : order;

  const section = ps().prepareSection(
    { type: blockType, order: nextOrder, data, visible: true },
    nextOrder,
    {
      template: portfolio.template,
      requestedCapability: options.requestedCapability,
    }
  );

  draft.sections.push(section);
  draft.sections = ps().normalizeSections(draft.sections, {
    template: portfolio.template,
    allowEmpty: true,
  });
  draft.approvalState = "pending_owner";
  return draft.save();
}

async function removeDraftSection(portfolioId, sectionId) {
  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const section = draft.sections.id(sectionId);
  if (!section) return null;

  section.deleteOne();
  draft.approvalState = "pending_owner";
  return draft.save();
}

async function reorderDraftSections(portfolioId, orderedIds) {
  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const sectionMap = new Map();
  for (const s of draft.sections) {
    sectionMap.set(sectionIdStr(s), s);
  }

  orderedIds.forEach((id, index) => {
    const section = sectionMap.get(String(id));
    if (section) section.order = index;
  });

  draft.sections.sort((a, b) => a.order - b.order);
  draft.approvalState = "pending_owner";
  return draft.save();
}

async function toggleDraftVisibility(portfolioId) {
  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  draft.visibility = draft.visibility === "public" ? "private" : "public";
  draft.approvalState = "pending_owner";
  await draft.save();
  return { _id: portfolioId, visibility: draft.visibility, draft: true };
}

async function toggleDraftBranding(portfolioId) {
  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  draft.hideBranding = !draft.hideBranding;
  draft.approvalState = "pending_owner";
  await draft.save();
  return { _id: portfolioId, hideBranding: draft.hideBranding, draft: true };
}

async function getOwnerDraft(portfolioId) {
  const published = await getPublishedPortfolio(portfolioId);
  if (!published) return null;

  const draft = await PortfolioDraft.findOne({ portfolioId }).lean();
  if (!draft) {
    return {
      portfolioId,
      hasDraft: false,
      draft: null,
      published,
    };
  }

  return {
    portfolioId,
    hasDraft: true,
    draft: draftToOwnerView(draft),
    published,
  };
}

async function getNextVersionNumber(portfolioId) {
  const latest = await PortfolioVersion.findOne({ portfolioId })
    .sort({ versionNumber: -1 })
    .select("versionNumber")
    .lean();
  return (latest?.versionNumber || 0) + 1;
}

async function pruneVersions(portfolioId) {
  const versions = await PortfolioVersion.find({ portfolioId })
    .sort({ versionNumber: -1 })
    .select("_id versionNumber")
    .lean();

  if (versions.length <= MAX_VERSIONS_PER_SITE) return;

  const toDelete = versions.slice(MAX_VERSIONS_PER_SITE);
  const ids = toDelete.map((v) => v._id);
  await PortfolioVersion.deleteMany({ _id: { $in: ids } });
}

function applyDraftSnapshotToPortfolioDocument(portfolio, draft) {
  const snap = extractSnapshotFromDoc(draft);
  portfolio.title = snap.title;
  portfolio.slug = snap.slug || undefined;
  portfolio.visibility = snap.visibility;
  portfolio.hideBranding = snap.hideBranding;
  portfolio.socialLinks = snap.socialLinks;
  portfolio.themeId = snap.themeId;
  portfolio.themeTokens = snap.themeTokens;
  portfolio.layoutMode = snap.layoutMode;
  portfolio.pageBannerDefaults = snap.pageBannerDefaults;
  portfolio.navBrand = snap.navBrand;
  portfolio.subUserSettings = snap.subUserSettings;
  portfolio.sections = snap.sections.map((s) => ({
    _id: s._id,
    type: s.type,
    order: s.order,
    visible: s.visible,
    data: s.data,
  }));
}

async function publishDraft(portfolioId, ownerId) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) return null;

  const draft = await ensureDraft(portfolioId);
  if (!draft) return null;

  const before = portfolio.toObject();
  applyDraftSnapshotToPortfolioDocument(portfolio, draft);

  const versionSnapshot = {
    ...extractSnapshotFromDoc(draft),
    sections: (draft.sections || []).map((s) => ({
      type: s.type,
      order: s.order,
      visible: s.visible !== false,
      data: cloneJson(s.data),
    })),
  };

  const saved = await portfolio.save();
  emitProfileChangeFromPublish(before, saved);

  const versionNumber = await insertVersionRecord(portfolioId, ownerId, draft, versionSnapshot);
  saved.publishedVersionNumber = versionNumber;
  await saved.save();

  await pruneVersions(portfolioId);

  if (ps().shouldNotifySitePublished(before, saved) && saved.owner) {
    notifySitePublished({
      ownerId: saved.owner,
      siteId: saved._id,
      publishedAt: new Date(),
    });
  }

  draft.approvalState = "approved";
  await draft.save();

  return {
    portfolio: saved,
    versionNumber,
  };
}

async function listVersions(portfolioId) {
  const versions = await PortfolioVersion.find({ portfolioId })
    .sort({ versionNumber: -1 })
    .select("versionNumber publishedAt publishedBy source")
    .lean();

  return versions.map((v) => ({
    versionNumber: v.versionNumber,
    publishedAt: v.publishedAt,
    source: v.source,
  }));
}

async function getVersionSnapshot(portfolioId, versionNumber) {
  const version = await PortfolioVersion.findOne({
    portfolioId,
    versionNumber: Number(versionNumber),
  }).lean();
  if (!version) return null;

  return {
    versionNumber: version.versionNumber,
    publishedAt: version.publishedAt,
    source: version.source,
    snapshot: version.snapshot,
  };
}

async function revertVersionToDraft(portfolioId, versionNumber) {
  const version = await PortfolioVersion.findOne({
    portfolioId,
    versionNumber: Number(versionNumber),
  }).lean();
  if (!version) return null;

  let draft = await PortfolioDraft.findOne({ portfolioId });
  const snap = version.snapshot;

  if (!draft) {
    draft = new PortfolioDraft({
      portfolioId,
      source: "owner",
      approvalState: "pending_owner",
    });
  }

  draft.title = snap.title || "";
  draft.slug = snap.slug || "";
  draft.visibility = snap.visibility || "private";
  draft.hideBranding = Boolean(snap.hideBranding);
  draft.socialLinks = cloneJson(snap.socialLinks);
  draft.themeId = snap.themeId || "";
  draft.themeTokens = cloneJson(snap.themeTokens);
  draft.layoutMode = snap.layoutMode || "auto";
  draft.pageBannerDefaults = cloneJson(snap.pageBannerDefaults);
  draft.navBrand = cloneJson(snap.navBrand);
  draft.subUserSettings = cloneJson(snap.subUserSettings);
  draft.sections = (snap.sections || []).map((s, index) => ({
    type: s.type,
    order: s.order ?? index,
    visible: s.visible !== false,
    data: cloneJson(s.data),
  }));
  draft.source = "owner";
  draft.approvalState = "pending_owner";

  await draft.save();

  return {
    draft: draftToOwnerView(draft),
    revertedFromVersion: version.versionNumber,
    note:
      "Revert loads the version into the working draft only. POST /:id/publish to make it live.",
  };
}

function draftMutationPortfolioResponse(draft) {
  const plain = ps().plainPortfolio(draft);
  return {
    _id: plain.portfolioId,
    title: plain.title,
    slug: plain.slug,
    visibility: plain.visibility,
    hideBranding: plain.hideBranding,
    socialLinks: plain.socialLinks,
    themeId: plain.themeId,
    themeTokens: plain.themeTokens,
    layoutMode: plain.layoutMode,
    pageBannerDefaults: plain.pageBannerDefaults,
    navBrand: plain.navBrand,
    subUserSettings: plain.subUserSettings,
    sections: plain.sections,
    draftMode: true,
    hasUnpublishedDraft: true,
    workingDraft: draftToOwnerView(draft),
  };
}

module.exports = {
  MAX_VERSIONS_PER_SITE,
  ensureDraft,
  ensureDraftForSource,
  applyExternalDraftSource,
  draftToOwnerView,
  updateDraftPortfolio,
  updateDraftSection,
  addDraftSection,
  removeDraftSection,
  reorderDraftSections,
  toggleDraftVisibility,
  toggleDraftBranding,
  getOwnerDraft,
  publishDraft,
  listVersions,
  getVersionSnapshot,
  revertVersionToDraft,
  draftMutationPortfolioResponse,
  deleteDraftAndVersionsForSite,
  insertVersionRecord,
};