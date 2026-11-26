const Portfolio = require("./models/Portfolio");
const portfolioDraftService = require("./portfolioDraft.service");
const portfolioService = require("./portfolio.service");
const { isSiteDraftsEnabled } = require("../../shared/config/siteDrafts");
const { isFeatureComponentsEnabled } = require("../../shared/config/featureComponents");
const {
  isFeatureComponentId,
  blockTypeForComponent,
  componentIdForBlockType,
  isUnifiedTemplate,
  normalizePuckType,
} = require("./models/componentRegistry");
const { validateComponentProps, ComponentConfigError } = require("./models/componentSchemas");
const {
  buildOwnerComponentsPayload,
  sectionToComponentData,
  sectionIdStr,
  puckPropsToSectionData,
  sectionDataToPuckProps,
} = require("./models/puckDataMapping");
const { recordComponentAudit } = require("./componentAudit.service");

const MAX_PORTFOLIO_SECTIONS = portfolioService.MAX_PORTFOLIO_SECTIONS;

class FeatureComponentsError extends Error {
  constructor(message, { status = 403, code = "feature_components_disabled", details } = {}) {
    super(message);
    this.name = "FeatureComponentsError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertComponentsAvailable() {
  if (!isFeatureComponentsEnabled()) {
    throw new FeatureComponentsError("Feature components are not enabled", {
      status: 404,
      code: "FEATURE_COMPONENTS_DISABLED",
    });
  }
}

function assertDraftWritesAllowed() {
  assertComponentsAvailable();
  if (!isSiteDraftsEnabled()) {
    throw new FeatureComponentsError("Site drafts must be enabled for component writes", {
      status: 403,
      code: "DRAFTS_REQUIRED",
    });
  }
}

function throwUnlessPortfolioOwner(check) {
  if (check.ok) return;
  const status = check.status === 403 ? 404 : check.status || 404;
  const code = status === 404 ? "not_found" : "not_found";
  throw new FeatureComponentsError(check.error || "Not found", {
    status,
    code,
  });
}

function resolveTypeAndProps(input = {}) {
  const rawType = input.type ?? input.componentId;
  const type = normalizePuckType(rawType);
  const props = input.props !== undefined ? input.props : input.config;
  return { type, props, rawType };
}

function mutationEnvelope(ctx, extra) {
  return {
    draftMode: true,
    approvalState: "pending_owner",
    source: ctx.draftSource,
    ...extra,
  };
}

async function loadListingContext(siteId, ownerId, { publishedOnly }) {
  const portfolio = await Portfolio.findById(siteId).select("owner template title sections").lean();
  if (!portfolio || String(portfolio.owner) !== String(ownerId)) return null;

  const draftView = await portfolioDraftService.getOwnerDraft(siteId);
  const hasDraft = Boolean(draftView?.hasDraft);

  if (publishedOnly) {
    return {
      template: portfolio.template,
      title: portfolio.title || "",
      sections: portfolio.sections || [],
      hasDraft,
      approvalState: hasDraft ? draftView.draft.approvalState : "approved",
      source: hasDraft ? draftView.draft.source : "owner",
      dataSource: "published",
    };
  }

  const sections = hasDraft
    ? draftView.draft.sections || []
    : draftView?.published?.sections || portfolio.sections || [];
  const title = hasDraft
    ? draftView.draft.title
    : draftView?.published?.title || portfolio.title || "";

  return {
    template: portfolio.template,
    title,
    sections,
    hasDraft,
    approvalState: hasDraft ? draftView.draft.approvalState : "approved",
    source: hasDraft ? draftView.draft.source : "owner",
    dataSource: hasDraft ? "draft" : "published",
  };
}

/**
 * @param {{ ownerId: string, siteId: string, audience?: 'public' | 'owner' | 'mcp' }} params
 */
async function listAvailableComponents({ ownerId, siteId, audience = "owner" }) {
  assertComponentsAvailable();
  const publishedOnly = audience === "public";
  const ctx = await loadListingContext(siteId, ownerId, { publishedOnly });
  if (!ctx) return null;

  const puckPayload = buildOwnerComponentsPayload({
    template: ctx.template,
    sections: isUnifiedTemplate(ctx.template) ? ctx.sections : [],
    title: ctx.title,
  });

  return {
    siteId: String(siteId),
    template: ctx.template,
    hasDraft: ctx.hasDraft,
    approvalState: ctx.approvalState,
    source: ctx.source,
    dataSource: ctx.dataSource,
    ...puckPayload,
  };
}

function plainSection(section) {
  if (!section) return null;
  return typeof section.toObject === "function" ? section.toObject() : section;
}

function publicSectionView(section, template) {
  const plain = plainSection(section);
  if (!plain) return null;
  const puckType = componentIdForBlockType(plain.type);
  const puckItem = sectionToComponentData(plain, template);
  return {
    sectionId: sectionIdStr(plain),
    type: puckType,
    blockType: plain.type,
    order: plain.order,
    visible: plain.visible !== false,
    props: puckItem?.props || {},
  };
}

async function resolveDraftAfterExternalWrite(siteId, source) {
  const draft = await portfolioDraftService.ensureDraftForSource(siteId, source);
  return draft;
}

async function writeAudit(ctx, payload) {
  await recordComponentAudit({
    portfolioId: ctx.siteId,
    ownerId: ctx.ownerId,
    ...payload,
    source: ctx.draftSource,
    authType: ctx.authType,
    installationId: ctx.installationId,
    apiKeyId: ctx.apiKeyId,
  });
}

function buildExternalWriteContext(publicApiAuth, siteId) {
  const authType = publicApiAuth.authType === "oauth" ? "oauth" : "api_key";
  const draftSource = authType === "oauth" ? "ai" : "api";
  return {
    ownerId: publicApiAuth.user._id,
    siteId: String(siteId),
    draftSource,
    authType,
    installationId: publicApiAuth.installationId || null,
    apiKeyId: publicApiAuth.key?._id || null,
  };
}

function assertUnifiedSiteTemplate(template) {
  if (!isUnifiedTemplate(template)) {
    throw new FeatureComponentsError("Feature components apply only to unified site templates", {
      status: 400,
      code: "validation_error",
      details: { field: "template", template },
    });
  }
}

function activeDraftSections(ctx) {
  const draftBefore = ctx.draftBefore;
  return draftBefore?.hasDraft
    ? draftBefore.draft.sections
    : draftBefore?.published?.sections || [];
}

async function addComponent(ctx, input) {
  assertDraftWritesAllowed();
  const { type, props, rawType } = resolveTypeAndProps(input);
  if (!type || !isFeatureComponentId(type)) {
    throw new ComponentConfigError("Unknown component type", {
      code: "unknown_component",
      details: { type: rawType },
    });
  }

  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  const listing = await loadListingContext(ctx.siteId, ctx.ownerId, { publishedOnly: false });
  if (!listing) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }
  assertUnifiedSiteTemplate(listing.template);

  const validated = validateComponentProps(type, props);
  const legacyData = puckPropsToSectionData(type, validated, listing.template, {});
  const blockType = blockTypeForComponent(type);
  const order = input.order;

  const draftBefore = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  const beforeIds = new Set(
    (draftBefore?.hasDraft ? draftBefore.draft.sections : draftBefore?.published?.sections || []).map(
      (s) => sectionIdStr(s)
    )
  );

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);
  const draft = await portfolioDraftService.addDraftSection(ctx.siteId, blockType, legacyData, order);
  if (!draft) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(draft, ctx.draftSource);

  const added = draft.sections.find(
    (s) => s.type === blockType && !beforeIds.has(sectionIdStr(s))
  );
  if (!added) {
    throw new FeatureComponentsError("Failed to locate added component section", {
      status: 500,
      code: "internal_error",
    });
  }

  await writeAudit(ctx, {
    action: "add",
    componentId: type,
    sectionId: sectionIdStr(added),
  });

  return mutationEnvelope(ctx, { section: publicSectionView(added, listing.template) });
}

async function updateComponent(ctx, { sectionId, props, config }) {
  const puckProps = props !== undefined ? props : config;
  assertDraftWritesAllowed();
  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);
  const draft = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  if (!draft) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }

  const listing = await loadListingContext(ctx.siteId, ctx.ownerId, { publishedOnly: false });
  if (!listing) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }
  assertUnifiedSiteTemplate(listing.template);

  const sections = draft.hasDraft ? draft.draft.sections : draft.published?.sections || [];
  const target = sections.find((s) => sectionIdStr(s) === String(sectionId));
  if (!target) {
    throw new FeatureComponentsError("Section not found", {
      status: 404,
      code: "not_found",
      details: { sectionId },
    });
  }

  const puckType = componentIdForBlockType(target.type);
  if (!puckType) {
    throw new FeatureComponentsError("Section is not a feature component", {
      status: 400,
      code: "not_a_component",
      details: { sectionId },
    });
  }

  const existingData = target.data && typeof target.data === "object" ? target.data : {};
  const existingPuck = sectionDataToPuckProps(puckType, existingData, listing.template);
  const validated = validateComponentProps(puckType, {
    ...existingPuck,
    ...puckProps,
    id: String(sectionId),
  });
  const legacyData = puckPropsToSectionData(puckType, validated, listing.template, existingData);
  const updatedDraft = await portfolioDraftService.updateDraftSection(ctx.siteId, sectionId, legacyData);
  if (!updatedDraft) {
    throw new FeatureComponentsError("Section not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(updatedDraft, ctx.draftSource);

  const section = updatedDraft.sections.id(sectionId);
  await writeAudit(ctx, {
    action: "update",
    componentId: puckType,
    sectionId,
  });

  return mutationEnvelope(ctx, { section: publicSectionView(section, listing.template) });
}

async function removeComponent(ctx, { sectionId }) {
  assertDraftWritesAllowed();
  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);
  const draftBefore = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  const sections = draftBefore?.hasDraft
    ? draftBefore.draft.sections
    : draftBefore?.published?.sections || [];
  const target = sections.find((s) => sectionIdStr(s) === String(sectionId));
  if (!target) {
    throw new FeatureComponentsError("Section not found", {
      status: 404,
      code: "not_found",
      details: { sectionId },
    });
  }

  const puckType = componentIdForBlockType(target.type);
  if (!puckType) {
    throw new FeatureComponentsError("Section is not a feature component", {
      status: 400,
      code: "not_a_component",
      details: { sectionId },
    });
  }

  const updatedDraft = await portfolioDraftService.removeDraftSection(ctx.siteId, sectionId);
  if (!updatedDraft) {
    throw new FeatureComponentsError("Section not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(updatedDraft, ctx.draftSource);

  await writeAudit(ctx, {
    action: "remove",
    componentId: puckType,
    sectionId,
  });

  return mutationEnvelope(ctx, { removedSectionId: String(sectionId) });
}

function validateReorderSectionIds(sectionIds, componentSectionIds) {
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    throw new FeatureComponentsError("sectionIds must be a non-empty array", {
      status: 400,
      code: "validation_error",
      details: { field: "sectionIds" },
    });
  }

  if (sectionIds.length > MAX_PORTFOLIO_SECTIONS) {
    throw new FeatureComponentsError(`sectionIds exceed the maximum of ${MAX_PORTFOLIO_SECTIONS}`, {
      status: 400,
      code: "validation_error",
      details: { field: "sectionIds", max: MAX_PORTFOLIO_SECTIONS },
    });
  }

  const normalizedIds = sectionIds.map((id) => String(id));
  const unique = new Set(normalizedIds);
  if (unique.size !== normalizedIds.length) {
    throw new FeatureComponentsError("sectionIds must not contain duplicates", {
      status: 400,
      code: "validation_error",
      details: { field: "sectionIds" },
    });
  }

  const expected = [...componentSectionIds].sort();
  const got = [...normalizedIds].sort();
  if (expected.length !== got.length || expected.some((id, i) => id !== got[i])) {
    throw new FeatureComponentsError("sectionIds must list every feature component section exactly once", {
      status: 400,
      code: "validation_error",
      details: {
        field: "sectionIds",
        expectedCount: expected.length,
        receivedCount: got.length,
      },
    });
  }
}

async function reorderComponents(ctx, { sectionIds }) {
  assertDraftWritesAllowed();
  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);

  const draftBefore = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  const sections = draftBefore?.hasDraft
    ? draftBefore.draft.sections
    : draftBefore?.published?.sections || [];

  const componentSectionIds = sections
    .filter((s) => componentIdForBlockType(s.type))
    .map((s) => sectionIdStr(s));

  validateReorderSectionIds(sectionIds, componentSectionIds);

  const componentOrdered = sectionIds.map((id) => String(id));
  const componentSectionIdSet = new Set(componentSectionIds);
  const baselineOrder = sections.map((s) => sectionIdStr(s));

  const mergedOrder = [];
  let ci = 0;
  for (const sid of baselineOrder) {
    if (componentSectionIdSet.has(sid)) {
      mergedOrder.push(componentOrdered[ci]);
      ci += 1;
    } else {
      mergedOrder.push(sid);
    }
  }

  if (mergedOrder.length > MAX_PORTFOLIO_SECTIONS) {
    throw new FeatureComponentsError(`Portfolio sections exceed the maximum of ${MAX_PORTFOLIO_SECTIONS}`, {
      status: 400,
      code: "validation_error",
      details: { max: MAX_PORTFOLIO_SECTIONS },
    });
  }

  const updatedDraft = await portfolioDraftService.reorderDraftSections(ctx.siteId, mergedOrder);
  if (!updatedDraft) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(updatedDraft, ctx.draftSource);

  await writeAudit(ctx, {
    action: "reorder",
    sectionId: "",
    componentId: "",
  });

  const portfolio = await Portfolio.findById(ctx.siteId).select("template").lean();
  const template = portfolio?.template;

  const viewSections = updatedDraft.sections
    .filter((s) => componentIdForBlockType(s.type))
    .map((s) => publicSectionView(s, template));

  return mutationEnvelope(ctx, { sections: viewSections });
}

module.exports = {
  FeatureComponentsError,
  ComponentConfigError,
  assertComponentsAvailable,
  assertDraftWritesAllowed,
  listAvailableComponents,
  buildExternalWriteContext,
  addComponent,
  updateComponent,
  removeComponent,
  reorderComponents,
  publicSectionView,
  resolveTypeAndProps,
};