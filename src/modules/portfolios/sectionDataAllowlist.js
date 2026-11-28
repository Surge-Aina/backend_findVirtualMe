class SectionDataValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "PortfolioValidationError";
    this.status = 400;
    this.code = "INVALID_SECTION_DATA";
    this.details = details;
  }
}

function reject(message, details) {
  throw new SectionDataValidationError(message, details);
}

const MAX_STRING = 4000;
const MAX_SHORT_STRING = 512;
const MAX_ITEM_ARRAY = 50;
const MAX_SKILL_ITEMS = 200;
const MAX_HIGHLIGHTS = 30;

function isForbiddenKey(key) {
  return key === "__proto__" || key === "constructor" || (typeof key === "string" && key.startsWith("$"));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedUrl(value, field) {
  if (value === undefined || value === null || value === "") return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    reject(`Invalid URL in ${field}`, {
      code: "INVALID_SECTION_DATA",
      details: { field },
    });
  }
  let protocol;
  try {
    protocol = new URL(trimmed).protocol;
  } catch (_err) {
    reject(`Invalid URL in ${field}`, {
      code: "INVALID_SECTION_DATA",
      details: { field },
    });
  }
  if (protocol !== "http:" && protocol !== "https:" && protocol !== "mailto:") {
    reject(`${field} must use http, https, or mailto`, {
      code: "INVALID_SECTION_DATA",
      details: { field },
    });
  }
  return trimmed;
}

function clipString(value, max = MAX_STRING) {
  if (value === undefined || value === null) return "";
  return String(value).slice(0, max);
}

function sanitizeStringField(value, max) {
  return clipString(value, max);
}

const URL_FIELDS = new Set([
  "resumeUrl",
  "profileImage",
  "url",
  "imageUrl",
  "logoUrl",
  "backgroundImage",
  "logoImage",
  "initialsBgImageUrl",
]);

function pickSummaryFields(input) {
  if (!isPlainObject(input)) {
    reject("summary content must be an object", {
      code: "INVALID_SECTION_DATA",
      details: { blockType: "summary" },
    });
  }
  const allowed = [
    "name",
    "title",
    "summary",
    "bio",
    "email",
    "phone",
    "location",
    "profileImage",
    "profileImageKey",
    "resumeUrl",
    "resumeKey",
  ];
  const out = {};
  for (const key of allowed) {
    if (input[key] === undefined) continue;
    if (URL_FIELDS.has(key)) {
      out[key] = assertAllowedUrl(input[key], key);
    } else if (key === "email") {
      out[key] = sanitizeStringField(input[key], MAX_SHORT_STRING);
    } else {
      out[key] = sanitizeStringField(input[key]);
    }
  }
  return out;
}

function pickHeroFields(input) {
  if (!isPlainObject(input)) {
    reject("hero content must be an object", {
      code: "INVALID_SECTION_DATA",
      details: { blockType: "hero" },
    });
  }
  const allowed = [
    "title",
    "subtitle",
    "description",
    "practiceName",
    "tagline",
    "primaryButtonText",
    "secondaryButtonText",
  ];
  const out = {};
  for (const key of allowed) {
    if (input[key] === undefined) continue;
    out[key] = sanitizeStringField(input[key]);
  }
  return out;
}

function sanitizeStringArray(value, { maxItems = MAX_SKILL_ITEMS, maxLen = MAX_SHORT_STRING } = {}) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    reject("items must be an array", {
      code: "INVALID_SECTION_DATA",
      details: { field: "items" },
    });
  }
  return value
    .slice(0, maxItems)
    .map((item) => sanitizeStringField(item, maxLen));
}

function sanitizeExperienceItem(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const key of ["title", "company", "location", "startDate", "endDate", "description"]) {
    if (raw[key] !== undefined) out[key] = sanitizeStringField(raw[key], MAX_SHORT_STRING);
  }
  if (raw.highlights !== undefined) {
    out.highlights = sanitizeStringArray(raw.highlights, {
      maxItems: MAX_HIGHLIGHTS,
      maxLen: MAX_STRING,
    });
  }
  return out;
}

function sanitizeProjectItem(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const key of ["title", "description"]) {
    if (raw[key] !== undefined) out[key] = sanitizeStringField(raw[key]);
  }
  if (raw.url !== undefined) out.url = assertAllowedUrl(raw.url, "url");
  if (raw.imageUrl !== undefined) out.imageUrl = assertAllowedUrl(raw.imageUrl, "imageUrl");
  if (raw.technologies !== undefined) {
    out.technologies = sanitizeStringArray(raw.technologies, { maxItems: 30 });
  }
  return out;
}

function sanitizeEducationItem(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const key of ["school", "degree", "field", "startDate", "endDate", "description"]) {
    if (raw[key] !== undefined) out[key] = sanitizeStringField(raw[key], MAX_SHORT_STRING);
  }
  return out;
}

function sanitizeItemsArray(value, mapItem) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    reject("items must be an array", {
      code: "INVALID_SECTION_DATA",
      details: { field: "items" },
    });
  }
  return value
    .slice(0, MAX_ITEM_ARRAY)
    .map(mapItem)
    .filter(Boolean);
}

function sanitizeListSection(blockType, data) {
  if (!isPlainObject(data)) {
    reject(`Section data for "${blockType}" must be an object`, {
      code: "INVALID_SECTION_DATA",
      details: { blockType },
    });
  }
  const out = {};
  if (data.items !== undefined) {
    if (blockType === "skills") {
      const items = sanitizeStringArray(data.items);
      out.items = items || [];
    } else if (blockType === "experience") {
      out.items = sanitizeItemsArray(data.items, sanitizeExperienceItem);
    } else if (blockType === "projects") {
      out.items = sanitizeItemsArray(data.items, sanitizeProjectItem);
    } else if (blockType === "education") {
      out.items = sanitizeItemsArray(data.items, sanitizeEducationItem);
    } else {
      reject(`Unknown list section "${blockType}"`, {
        code: "INVALID_SECTION_DATA",
        details: { blockType },
      });
    }
  }
  return out;
}

function sanitizeContactSection(data) {
  if (!isPlainObject(data)) {
    reject('Section data for "contact" must be an object', {
      code: "INVALID_SECTION_DATA",
      details: { blockType: "contact" },
    });
  }
  const allowed = [
    "email",
    "phone",
    "location",
    "headline",
    "title",
    "submitText",
    "buttonText",
    "whatsapp",
    "address",
    "pageBanner",
  ];
  const out = {};
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    if (key === "address" || key === "pageBanner") {
      out[key] = stripForbiddenDeep(data[key]);
    } else if (URL_FIELDS.has(key)) {
      out[key] = assertAllowedUrl(data[key], key);
    } else {
      out[key] = sanitizeStringField(data[key], key === "location" ? MAX_STRING : MAX_SHORT_STRING);
    }
  }
  return out;
}

function stripForbiddenDeep(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) => stripForbiddenDeep(v, depth + 1));
  }
  if (!isPlainObject(value)) {
    if (typeof value === "string") return clipString(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    return null;
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (isForbiddenKey(key)) continue;
    const next = stripForbiddenDeep(val, depth + 1);
    if (next !== null && next !== undefined) out[key] = next;
  }
  return out;
}

function sanitizeSectionDataAllowlist(blockType, data) {
  if (data === undefined) return {};
  if (!isPlainObject(data)) {
    reject(`Section data for "${blockType}" must be an object`, {
      code: "INVALID_SECTION_DATA",
      details: { blockType },
    });
  }
  for (const key of Object.keys(data)) {
    if (isForbiddenKey(key)) {
      reject("Disallowed key in section data", {
        code: "INVALID_SECTION_DATA",
        details: { blockType, field: key },
      });
    }
  }

  switch (blockType) {
    case "summary":
      return pickSummaryFields(data);
    case "hero":
      return pickHeroFields(data);
    case "skills":
    case "experience":
    case "projects":
    case "education":
      return sanitizeListSection(blockType, data);
    case "contact":
      return sanitizeContactSection(data);
    default:
      return stripForbiddenDeep(data);
  }
}

module.exports = {
  isForbiddenKey,
  assertAllowedUrl,
  pickSummaryFields,
  pickHeroFields,
  sanitizeSectionDataAllowlist,
};