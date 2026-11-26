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
} = require("./models/puckDataMapping");
const { recordComponentAudit } = require("./componentAudit.service");

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
  const code = status === 404 ? "not_found" : check.status === 403 ? "forbidden" : "not_found";
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

async function loadSiteSectionsAndTitle(siteId, ownerId) {
  const portfolio = await Portfolio.findById(siteId).select("owner template title sections").lean();
  if (!portfolio || String(portfolio.owner) !== String(ownerId)) return null;

  const draftView = await portfolioDraftService.getOwnerDraft(siteId);
  const sections = draftView?.hasDraft
    ? draftView.draft.sections || []
    : draftView?.published?.sections || portfolio.sections || [];
  const title = draftView?.hasDraft ? draftView.draft.title : draftView?.published?.title || portfolio.title;

  return { template: portfolio.template, sections, title };
}

async function listAvailableComponents({ ownerId, siteId }) {
  assertComponentsAvailable();
  const site = await loadSiteSectionsAndTitle(siteId, ownerId);
  if (!site) return null;

  const puckPayload = buildOwnerComponentsPayload({
    template: site.template,
    sections: isUnifiedTemplate(site.template) ? site.sections : [],
    title: site.title,
  });

  return {
    siteId: String(siteId),
    template: site.template,
    ...puckPayload,
  };
}

function publicSectionView(section) {
  const puckType = componentIdForBlockType(section.type);
  const puckItem = sectionToComponentData(section);
  return {
    sectionId: sectionIdStr(section),
    type: puckType,
    blockType: section.type,
    order: section.order,
    visible: section.visible !== false,
    props: puckItem?.props || {},
  };
}

async function resolveDraftAfterExternalWrite(siteId, source) {
  const draft = await portfolioDraftService.ensureDraftForSource(siteId, source);
  return draft;
}

async function writeAudit(ctx, payload) {
  await recordComponentAudit({
    portfolioId: siteIdFromCtx(ctx),
    ownerId: ctx.ownerId,
    ...payload,
    source: ctx.draftSource,
    authType: ctx.authType,
    installationId: ctx.installationId,
    apiKeyId: ctx.apiKeyId,
  });
}

function siteIdFromCtx(ctx) {
  return ctx.siteId;
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

  const validated = validateComponentProps(type, props);
  const blockType = blockTypeForComponent(type);
  const order = input.order;

  const draftBefore = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  const beforeIds = new Set(
    (draftBefore?.hasDraft ? draftBefore.draft.sections : draftBefore?.published?.sections || []).map(
      (s) => sectionIdStr(s)
    )
  );

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);
  const draft = await portfolioDraftService.addDraftSection(
    ctx.siteId,
    blockType,
    validated,
    order,
    { componentWrite: true }
  );
  if (!draft) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(draft, ctx.draftSource);

  const added = draft.sections.find((s) => !beforeIds.has(sectionIdStr(s))) || draft.sections[draft.sections.length - 1];

  await writeAudit(ctx, {
    action: "add",
    componentId: type,
    sectionId: sectionIdStr(added),
  });

  return {
    draftMode: true,
    approvalState: "pending_owner",
    source: ctx.draftSource,
    section: publicSectionView(added),
    portfolio: portfolioDraftService.draftMutationPortfolioResponse(draft),
  };
}

async function updateComponent(ctx, { sectionId, props, config, type: _t, componentId: _c }) {
  const puckProps = props !== undefined ? props : config;
  assertDraftWritesAllowed();
  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);
  const draft = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  if (!draft) {
    throw new FeatureComponentsError("Site not found", { status: 404, code: "not_found" });
  }

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

  const validated = validateComponentProps(puckType, {
    ...target.data,
    ...puckProps,
    id: String(sectionId),
  });
  const updatedDraft = await portfolioDraftService.updateDraftSection(
    ctx.siteId,
    sectionId,
    validated
  );
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

  return {
    draftMode: true,
    approvalState: "pending_owner",
    source: ctx.draftSource,
    section: publicSectionView(section),
    portfolio: portfolioDraftService.draftMutationPortfolioResponse(updatedDraft),
  };
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
  const puckType = target ? componentIdForBlockType(target.type) : "";

  const updatedDraft = await portfolioDraftService.removeDraftSection(ctx.siteId, sectionId);
  if (!updatedDraft) {
    throw new FeatureComponentsError("Section not found", { status: 404, code: "not_found" });
  }

  await portfolioDraftService.applyExternalDraftSource(updatedDraft, ctx.draftSource);

  await writeAudit(ctx, {
    action: "remove",
    componentId: puckType || "",
    sectionId,
  });

  return {
    draftMode: true,
    approvalState: "pending_owner",
    source: ctx.draftSource,
    removedSectionId: String(sectionId),
    portfolio: portfolioDraftService.draftMutationPortfolioResponse(updatedDraft),
  };
}

async function reorderComponents(ctx, { sectionIds }) {
  assertDraftWritesAllowed();
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    throw new FeatureComponentsError("sectionIds must be a non-empty array", {
      status: 400,
      code: "validation_error",
      details: { field: "sectionIds" },
    });
  }

  const ownerCheck = await portfolioService.assertPortfolioOwner(ctx.siteId, ctx.ownerId);
  throwUnlessPortfolioOwner(ownerCheck);

  await resolveDraftAfterExternalWrite(ctx.siteId, ctx.draftSource);

  const draftBefore = await portfolioDraftService.getOwnerDraft(ctx.siteId);
  const sections = draftBefore?.hasDraft
    ? draftBefore.draft.sections
    : draftBefore?.published?.sections || [];

  const componentSectionIds = new Set(
    sections.filter((s) => componentIdForBlockType(s.type)).map((s) => sectionIdStr(s))
  );

  for (const id of sectionIds) {
    if (!componentSectionIds.has(String(id))) {
      throw new FeatureComponentsError("sectionIds must reference feature component sections", {
        status: 400,
        code: "validation_error",
        details: { field: "sectionIds", invalidId: String(id) },
      });
    }
  }

  const componentOrdered = sectionIds.map((id) => String(id));
  const baselineOrder = sections.map((s) => sectionIdStr(s));

  const mergedOrder = [];
  let ci = 0;
  for (const sid of baselineOrder) {
    if (componentSectionIds.has(sid)) {
      if (ci < componentOrdered.length) {
        mergedOrder.push(componentOrdered[ci]);
        ci += 1;
      }
    } else {
      mergedOrder.push(sid);
    }
  }
  while (ci < componentOrdered.length) {
    mergedOrder.push(componentOrdered[ci]);
    ci += 1;
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

  const viewSections = updatedDraft.sections
    .filter((s) => componentIdForBlockType(s.type))
    .map(publicSectionView);

  return {
    draftMode: true,
    approvalState: "pending_owner",
    source: ctx.draftSource,
    sections: viewSections,
    portfolio: portfolioDraftService.draftMutationPortfolioResponse(updatedDraft),
  };
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