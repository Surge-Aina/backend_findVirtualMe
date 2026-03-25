const Portfolio = require("../models/portfolio/Portfolio");
const { getDefaultSections } = require("../models/portfolio/templateDefaults");
const {
  BLOCK_TYPES,
  KNOWN_BLOCK_TYPES,
  getBlockTypesForTemplate,
  isKnownBlockType,
} = require("../models/portfolio/blockTypes");

const MAX_PORTFOLIO_SECTIONS = 24;
const MAX_SECTION_DATA_BYTES = 50 * 1024;
const MAX_BLOCK_HINTS = 5;

class PortfolioValidationError extends Error {
  constructor(message, { status = 400, code = "INVALID_PORTFOLIO_INPUT", details } = {}) {
    super(message);
    this.name = "PortfolioValidationError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getJsonSizeBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch (err) {
    return Infinity;
  }
}

function getBlockCatalog(template) {
  if (!template) {
    return Object.entries(BLOCK_TYPES).map(([type, meta]) => ({ type, ...meta }));
  }
  return getBlockTypesForTemplate(template);
}

function scoreBlockHint(block, requestedCapability) {
  if (!requestedCapability) return 0;

  const query = requestedCapability.toLowerCase();
  const haystack = [block.type, block.label, block.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack === query) return 100;
  if (haystack.includes(query)) return 50;

  return query.split(/\s+/).reduce((score, token) => {
    if (!token) return score;
    return haystack.includes(token) ? score + 10 : score;
  }, 0);
}

function getClosestKnownBlocks(template, requestedCapability) {
  const catalog = getBlockCatalog(template);
  const ranked = catalog
    .map((block) => ({
      type: block.type,
      score: scoreBlockHint(block, requestedCapability),
    }))
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
    .slice(0, MAX_BLOCK_HINTS)
    .map((item) => item.type);

  return ranked.length ? ranked : KNOWN_BLOCK_TYPES.slice(0, MAX_BLOCK_HINTS);
}

function buildUnknownBlockTypeError(blockType, { template, requestedCapability } = {}) {
  return new PortfolioValidationError(`Unknown block type: ${blockType}`, {
    code: "UNSUPPORTED_BLOCK_NEED",
    details: {
      blockType,
      template: template || null,
      requestedCapability: requestedCapability || null,
      closestKnownBlocks: getClosestKnownBlocks(template, requestedCapability),
    },
  });
}

function validateSectionData(blockType, data) {
  if (data === undefined) return {};
  if (!isPlainObject(data)) {
    throw new PortfolioValidationError(
      `Section data for "${blockType}" must be an object`,
      {
        code: "INVALID_SECTION_DATA",
        details: { blockType },
      }
    );
  }

  const sizeBytes = getJsonSizeBytes(data);
  if (sizeBytes > MAX_SECTION_DATA_BYTES) {
    throw new PortfolioValidationError(
      `Section data for "${blockType}" exceeds ${MAX_SECTION_DATA_BYTES} bytes`,
      {
        code: "SECTION_DATA_TOO_LARGE",
        details: {
          blockType,
          sizeBytes,
          maxBytes: MAX_SECTION_DATA_BYTES,
        },
      }
    );
  }

  return data;
}

function normalizeThemeId(themeId, template) {
  if (themeId === undefined) {
    return template === "agent" ? "aurora" : "";
  }
  if (themeId === null) return "";
  return String(themeId).trim();
}

function normalizeThemeTokens(themeTokens) {
  if (themeTokens === undefined) return {};
  if (!isPlainObject(themeTokens)) {
    throw new PortfolioValidationError("themeTokens must be an object", {
      code: "INVALID_THEME_TOKENS",
    });
  }
  return themeTokens;
}

function normalizeLayoutMode(layoutMode, template) {
  if (layoutMode === undefined || layoutMode === null || layoutMode === "") {
    return template === "agent" ? "stacked" : "auto";
  }

  const normalized = String(layoutMode).trim();
  if (!["auto", "singleSection", "stacked"].includes(normalized)) {
    throw new PortfolioValidationError(`Unsupported layoutMode: ${layoutMode}`, {
      code: "INVALID_LAYOUT_MODE",
      details: {
        allowed: ["auto", "singleSection", "stacked"],
      },
    });
  }
  return normalized;
}

function prepareSection(section, index, options = {}) {
  const { template, requestedCapability } = options;

  if (!isPlainObject(section)) {
    throw new PortfolioValidationError("Each section must be an object", {
      code: "INVALID_SECTION",
    });
  }

  const type = typeof section.type === "string" ? section.type.trim() : "";
  if (!type) {
    throw new PortfolioValidationError("Each section requires a type", {
      code: "SECTION_TYPE_REQUIRED",
    });
  }

  if (!isKnownBlockType(type)) {
    throw buildUnknownBlockTypeError(type, { template, requestedCapability });
  }

  const order =
    section.order === undefined || section.order === null
      ? index
      : Number(section.order);

  if (!Number.isFinite(order)) {
    throw new PortfolioValidationError(`Section order for "${type}" must be a number`, {
      code: "INVALID_SECTION_ORDER",
      details: { blockType: type },
    });
  }

  return {
    type,
    order,
    visible: section.visible === undefined ? true : Boolean(section.visible),
    data: validateSectionData(type, section.data),
  };
}

function normalizeSections(sections, options = {}) {
  const { allowEmpty = true } = options;

  if (!Array.isArray(sections)) {
    throw new PortfolioValidationError("sections must be an array", {
      code: "INVALID_SECTIONS",
    });
  }

  if (!allowEmpty && sections.length === 0) {
    throw new PortfolioValidationError("sections must contain at least one block", {
      code: "SECTIONS_REQUIRED",
    });
  }

  if (sections.length > MAX_PORTFOLIO_SECTIONS) {
    throw new PortfolioValidationError(
      `sections exceed the maximum of ${MAX_PORTFOLIO_SECTIONS}`,
      {
        code: "SECTION_LIMIT_EXCEEDED",
        details: {
          maxSections: MAX_PORTFOLIO_SECTIONS,
          received: sections.length,
        },
      }
    );
  }

  return sections
    .map((section, index) => ({
      sourceIndex: index,
      section: prepareSection(section, index, options),
    }))
    .sort((a, b) => {
      return (
        a.section.order - b.section.order || a.sourceIndex - b.sourceIndex
      );
    })
    .map(({ section }, index) => ({
      ...section,
      order: index,
    }));
}

// ─── Create ──────────────────────────────────────────────────────────────────

async function createPortfolio(ownerId, template, overrides = {}) {
  const rawSections =
    overrides.sections !== undefined
      ? overrides.sections
      : getDefaultSections(template);
  const sections = normalizeSections(rawSections, {
    template,
    requestedCapability: overrides.requestedCapability,
    allowEmpty: true,
  });

  const doc = new Portfolio({
    owner: ownerId,
    template,
    title: overrides.title || "",
    slug: overrides.slug || undefined,
    visibility: overrides.visibility || "private",
    hideBranding: overrides.hideBranding || false,
    socialLinks: overrides.socialLinks || {},
    sections,
    createdBy: overrides.createdBy || "user",
    generationModel: overrides.generationModel || "",
    generationVersion: overrides.generationVersion || "",
    generationPromptHash: overrides.generationPromptHash || "",
    themeId: normalizeThemeId(overrides.themeId, template),
    themeTokens: normalizeThemeTokens(overrides.themeTokens),
    layoutMode: normalizeLayoutMode(overrides.layoutMode, template),
  });

  return doc.save();
}

async function createAgentPortfolio(ownerId, payload = {}) {
  const { baseTemplate, sections } = payload;

  if (!baseTemplate) {
    throw new PortfolioValidationError("baseTemplate is required", {
      code: "BASE_TEMPLATE_REQUIRED",
    });
  }

  return createPortfolio(ownerId, baseTemplate, {
    ...payload,
    sections: normalizeSections(sections, {
      template: baseTemplate,
      requestedCapability: payload.requestedCapability,
      allowEmpty: false,
    }),
    createdBy: "agent",
  });
}

// ─── Read ────────────────────────────────────────────────────────────────────

async function getPortfolio(id) {
  return Portfolio.findById(id).lean();
}

async function getPortfolioBySlug(slug) {
  return Portfolio.findOne({ slug }).lean();
}

async function getUserPortfolios(ownerId) {
  return Portfolio.find({ owner: ownerId }).lean();
}

async function getPublicPortfolios(template) {
  const filter = { visibility: "public" };
  if (template) filter.template = template;
  return Portfolio.find(filter).lean();
}

/**
 * Ensure the authenticated user owns the portfolio. Used for all mutating routes.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
async function assertPortfolioOwner(portfolioId, userId) {
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const doc = await Portfolio.findById(portfolioId).select("owner").lean();
  if (!doc) {
    return { ok: false, status: 404, error: "Portfolio not found" };
  }
  const ownerStr = doc.owner?.toString();
  const userStr = userId.toString();
  if (ownerStr !== userStr) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

// ─── Update base fields ─────────────────────────────────────────────────────

async function updatePortfolio(id, updates) {
  const allowed = [
    "title",
    "slug",
    "visibility",
    "hideBranding",
    "socialLinks",
    "sections",
    "themeId",
    "themeTokens",
    "layoutMode",
  ];
  const sanitized = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  if (sanitized.sections !== undefined) {
    const current = await Portfolio.findById(id).select("template");
    if (!current) return null;
    sanitized.sections = normalizeSections(sanitized.sections, {
      template: current.template,
      requestedCapability: updates.requestedCapability,
      allowEmpty: true,
    });
    if (sanitized.themeId !== undefined) {
      sanitized.themeId = normalizeThemeId(sanitized.themeId, current.template);
    }
    if (sanitized.themeTokens !== undefined) {
      sanitized.themeTokens = normalizeThemeTokens(sanitized.themeTokens);
    }
    if (sanitized.layoutMode !== undefined) {
      sanitized.layoutMode = normalizeLayoutMode(sanitized.layoutMode, current.template);
    }
  } else if (
    sanitized.themeId !== undefined ||
    sanitized.themeTokens !== undefined ||
    sanitized.layoutMode !== undefined
  ) {
    const current = await Portfolio.findById(id).select("template");
    if (!current) return null;
    if (sanitized.themeId !== undefined) {
      sanitized.themeId = normalizeThemeId(sanitized.themeId, current.template);
    }
    if (sanitized.themeTokens !== undefined) {
      sanitized.themeTokens = normalizeThemeTokens(sanitized.themeTokens);
    }
    if (sanitized.layoutMode !== undefined) {
      sanitized.layoutMode = normalizeLayoutMode(sanitized.layoutMode, current.template);
    }
  }

  return Portfolio.findByIdAndUpdate(id, { $set: sanitized }, { new: true });
}

// ─── Section-level operations ────────────────────────────────────────────────

async function updateSection(portfolioId, sectionId, data) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) return null;

  const section = portfolio.sections.id(sectionId);
  if (!section) return null;

  section.data = validateSectionData(section.type, data);
  return portfolio.save();
}

async function addSection(portfolioId, blockType, data, order, options = {}) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) return null;

  const nextOrder =
    order === undefined || order === null
      ? portfolio.sections.reduce((max, s) => Math.max(max, s.order), -1) + 1
      : order;

  const section = prepareSection(
    { type: blockType, order: nextOrder, data, visible: true },
    nextOrder,
    {
      template: portfolio.template,
      requestedCapability: options.requestedCapability,
    }
  );

  portfolio.sections.push(section);
  portfolio.sections = normalizeSections(portfolio.sections, {
    template: portfolio.template,
    allowEmpty: true,
  });
  return portfolio.save();
}

async function removeSection(portfolioId, sectionId) {
  return Portfolio.findByIdAndUpdate(
    portfolioId,
    { $pull: { sections: { _id: sectionId } } },
    { new: true }
  );
}

async function reorderSections(portfolioId, orderedIds) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) return null;

  const sectionMap = new Map();
  for (const s of portfolio.sections) {
    sectionMap.set(s._id.toString(), s);
  }

  orderedIds.forEach((id, index) => {
    const section = sectionMap.get(id);
    if (section) section.order = index;
  });

  portfolio.sections.sort((a, b) => a.order - b.order);
  return portfolio.save();
}

// ─── Toggle helpers ──────────────────────────────────────────────────────────

async function toggleVisibility(id) {
  const doc = await Portfolio.findById(id).select("visibility");
  if (!doc) return null;

  doc.visibility = doc.visibility === "public" ? "private" : "public";
  await doc.save();
  return { _id: doc._id, visibility: doc.visibility };
}

async function toggleBranding(id) {
  const doc = await Portfolio.findById(id).select("hideBranding");
  if (!doc) return null;

  doc.hideBranding = !doc.hideBranding;
  await doc.save();
  return { _id: doc._id, hideBranding: doc.hideBranding };
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function deletePortfolio(id) {
  const doc = await Portfolio.findByIdAndDelete(id);
  return doc ? { _id: doc._id } : null;
}

module.exports = {
  MAX_PORTFOLIO_SECTIONS,
  MAX_SECTION_DATA_BYTES,
  PortfolioValidationError,
  normalizeSections,
  createAgentPortfolio,
  createPortfolio,
  getPortfolio,
  getPortfolioBySlug,
  getUserPortfolios,
  getPublicPortfolios,
  assertPortfolioOwner,
  updatePortfolio,
  updateSection,
  addSection,
  removeSection,
  reorderSections,
  toggleVisibility,
  toggleBranding,
  deletePortfolio,
};
