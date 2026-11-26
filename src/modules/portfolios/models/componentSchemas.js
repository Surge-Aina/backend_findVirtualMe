const { normalizePuckType, PUCK_COMPONENTS } = require("./componentRegistry");
const { propsToSectionData } = require("./puckDataMapping");

const MAX_CONFIG_BYTES = 50 * 1024;

class ComponentConfigError extends Error {
  constructor(message, { status = 400, code = "invalid_component_config", details } = {}) {
    super(message);
    this.name = "ComponentConfigError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function configSizeBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
  } catch (_err) {
    return Infinity;
  }
}

function getConfigJsonSchema(typeOrLegacyId) {
  const type = normalizePuckType(typeOrLegacyId);
  if (!type) return null;
  const entry = PUCK_COMPONENTS[type];
  if (!entry) return null;
  return {
    type: "object",
    description: "Puck props object (ComponentData.props); id is optional on create.",
    properties: Object.fromEntries(
      Object.keys({ ...entry.defaultProps, id: "" }).map((key) => [key, { type: "unknown" }])
    ),
    puckFields: entry.fields,
    defaultProps: entry.defaultProps,
  };
}

function assertAllowedKey(key, path) {
  if (key === "id") return;
  if (key === "__proto__" || key === "constructor") {
    throw new ComponentConfigError(`Invalid prop at ${path}`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
}

const PATH_SEGMENT = /^[a-zA-Z0-9_.~%-]*$/;
const PATH_QUERY = /^[a-zA-Z0-9&=%_.~+-]*$/;

function validateHttpUrlWithHost(value, path) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    throw new ComponentConfigError(`${path} must be a non-empty http(s) URL`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_err) {
    throw new ComponentConfigError(`${path} must be a valid http(s) URL`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ComponentConfigError(`${path} must use http or https`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  if (!parsed.hostname) {
    throw new ComponentConfigError(`${path} must include a host`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  return trimmed;
}

function validateHttpUrlString(value, path) {
  validateHttpUrlWithHost(value, path);
}

function validateSameSitePath(value, path) {
  if (value.length > 512) {
    throw new ComponentConfigError(`${path} must be a valid same-site path`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new ComponentConfigError(`${path} must be a valid same-site path`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  if (value.length < 2 || value[1] === "/") {
    throw new ComponentConfigError(`${path} must be a valid same-site path`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }

  const qIdx = value.indexOf("?");
  const pathPart = qIdx >= 0 ? value.slice(0, qIdx) : value;
  const query = qIdx >= 0 ? value.slice(qIdx + 1) : null;

  const segments = pathPart.split("/").slice(1);
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      throw new ComponentConfigError(`${path} must not contain '.' or '..' segments`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
    if (!PATH_SEGMENT.test(seg)) {
      throw new ComponentConfigError(`${path} must be a valid same-site path`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
  }

  if (query !== null) {
    if (query.length > 512) {
      throw new ComponentConfigError(`${path} query exceeds maximum length`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
    if (!PATH_QUERY.test(query)) {
      throw new ComponentConfigError(`${path} has an invalid query string`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
  }
}

function normalizeQrCodeTarget(value, path = "target") {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new ComponentConfigError(`${path} must be a string`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    validateSameSitePath(trimmed, path);
    return trimmed;
  }
  return validateHttpUrlWithHost(trimmed, path);
}

function validateObjectIdProp(value, path, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ComponentConfigError(`${path} is required`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
    return;
  }
  if (typeof value !== "string" || !/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new ComponentConfigError(`${path} must be a valid id`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
}

function validateTextValue(value, field, path, { required = false, httpUrl = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw new ComponentConfigError(`${path} is required`, {
        code: "invalid_component_config",
        details: { field: path },
      });
    }
    return;
  }
  if (typeof value !== "string") {
    throw new ComponentConfigError(`${path} must be a string`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  const max = field.maxLength ?? 4000;
  if (value.length > max) {
    throw new ComponentConfigError(`${path} exceeds maximum length`, {
      code: "invalid_component_config",
      details: { field: path, max },
    });
  }
  if (httpUrl || path.endsWith(".url")) {
    validateHttpUrlWithHost(value, path);
  }
}

function validateNumberValue(value, field, path) {
  if (value === undefined || value === null) return;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ComponentConfigError(`${path} must be a number`, {
      code: "invalid_component_config",
      details: { field: path },
    });
  }
  if (field.min !== undefined && num < field.min) {
    throw new ComponentConfigError(`${path} must be >= ${field.min}`, {
      code: "invalid_component_config",
      details: { field: path, min: field.min },
    });
  }
  if (field.max !== undefined && num > field.max) {
    throw new ComponentConfigError(`${path} must be <= ${field.max}`, {
      code: "invalid_component_config",
      details: { field: path, max: field.max },
    });
  }
}

function validateRadioValue(value, field, path) {
  if (value === undefined || value === null) return;
  const options = field.options || [];
  const allowed = options.map((o) => o.value);
  if (!allowed.some((v) => v === value)) {
    throw new ComponentConfigError(`${path} has an invalid value`, {
      code: "invalid_component_config",
      details: { field: path, allowed },
    });
  }
}

function stripFieldValue(field, value) {
  if (value === undefined || value === null) return value;
  switch (field.type) {
    case "object": {
      const out = {};
      const objectFields = field.objectFields || {};
      for (const key of Object.keys(objectFields)) {
        if (value[key] !== undefined) {
          out[key] = stripFieldValue(objectFields[key], value[key]);
        }
      }
      return out;
    }
    case "array":
      return (Array.isArray(value) ? value : []).map((item) =>
        stripFieldValue({ type: "object", objectFields: field.arrayFields || {} }, item)
      );
    default:
      return value;
  }
}

function stripPropsAgainstFields(fields, value) {
  if (!fields || value === undefined || value === null) return {};
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
    if (value[key] === undefined) continue;
    out[key] = stripFieldValue(field, value[key]);
  }
  return out;
}

function validateFieldValue(field, value, path, { required = false } = {}) {
  switch (field.type) {
    case "text":
    case "textarea":
      validateTextValue(value, field, path, { required, httpUrl: path.endsWith(".url") });
      break;
    case "number":
      validateNumberValue(value, field, path);
      break;
    case "radio":
      validateRadioValue(value, field, path);
      break;
    case "object":
      if (value === undefined || value === null) return;
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new ComponentConfigError(`${path} must be an object`, {
          code: "invalid_component_config",
          details: { field: path },
        });
      }
      for (const key of Object.keys(value)) {
        assertAllowedKey(key, `${path}.${key}`);
        const sub = field.objectFields?.[key];
        if (sub) {
          validateFieldValue(sub, value[key], `${path}.${key}`);
        } else {
          throw new ComponentConfigError(`Unknown nested prop "${key}"`, {
            code: "invalid_component_config",
            details: { field: `${path}.${key}` },
          });
        }
      }
      break;
    case "array":
      if (value === undefined || value === null) return;
      if (!Array.isArray(value)) {
        throw new ComponentConfigError(`${path} must be an array`, {
          code: "invalid_component_config",
          details: { field: path },
        });
      }
      if (field.min !== undefined && value.length < field.min) {
        throw new ComponentConfigError(`${path} requires at least ${field.min} items`, {
          code: "invalid_component_config",
          details: { field: path, min: field.min },
        });
      }
      if (field.max !== undefined && value.length > field.max) {
        throw new ComponentConfigError(`${path} exceeds ${field.max} items`, {
          code: "invalid_component_config",
          details: { field: path, max: field.max },
        });
      }
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (typeof item !== "object" || !item || Array.isArray(item)) {
          throw new ComponentConfigError(`${itemPath} must be an object`, {
            code: "invalid_component_config",
            details: { field: itemPath },
          });
        }
        const arrayFields = field.arrayFields || {};
        for (const key of Object.keys(item)) {
          assertAllowedKey(key, `${itemPath}.${key}`);
          const sub = arrayFields[key];
          if (sub) {
            validateFieldValue(sub, item[key], `${itemPath}.${key}`, {
              required: sub.type === "text" && key === "url",
            });
          } else {
            throw new ComponentConfigError(`Unknown nested prop "${key}"`, {
              code: "invalid_component_config",
              details: { field: `${itemPath}.${key}` },
            });
          }
        }
        if (arrayFields.url && item.url !== undefined) {
          validateTextValue(
            item.url,
            { ...arrayFields.url, maxLength: 2048 },
            `${itemPath}.url`,
            { required: true, httpUrl: true }
          );
        }
        if (arrayFields.title && item.title !== undefined) {
          validateTextValue(item.title, arrayFields.title, `${itemPath}.title`, { required: true });
        }
        if (arrayFields.quote && item.quote !== undefined) {
          validateTextValue(item.quote, arrayFields.quote, `${itemPath}.quote`, { required: true });
        }
        if (arrayFields.day && item.day !== undefined) {
          validateTextValue(item.day, arrayFields.day, `${itemPath}.day`, { required: true });
        }
        if (arrayFields.rating !== undefined && item.rating !== undefined) {
          validateNumberValue(item.rating, arrayFields.rating, `${itemPath}.rating`);
        }
      });
      break;
    default:
      break;
  }
}

function mergeWithDefaultProps(defaultProps, props) {
  const base = JSON.parse(JSON.stringify(defaultProps || {}));
  if (!props || typeof props !== "object") return base;
  return { ...base, ...props };
}

function validateComponentProps(typeOrLegacyId, props) {
  const type = normalizePuckType(typeOrLegacyId);
  if (!type) {
    throw new ComponentConfigError("Unknown component type", {
      code: "unknown_component",
      details: { type: typeOrLegacyId },
    });
  }

  const entry = PUCK_COMPONENTS[type];
  const merged = mergeWithDefaultProps(entry.defaultProps, props);

  if (props?.id !== undefined && props.id !== null && typeof props.id !== "string") {
    throw new ComponentConfigError("props.id must be a string when provided", {
      code: "invalid_component_config",
      details: { field: "id" },
    });
  }

  for (const key of Object.keys(props || {})) {
    assertAllowedKey(key, key);
    if (!entry.fields[key] && key !== "id") {
      throw new ComponentConfigError(`Unknown prop "${key}"`, {
        code: "invalid_component_config",
        details: { field: key, type },
      });
    }
  }

  for (const [key, field] of Object.entries(entry.fields)) {
    validateFieldValue(field, merged[key], key);
  }

  if (type === "QrCode") {
    if (merged.target !== undefined && merged.target !== null && merged.target !== "") {
      merged.target = normalizeQrCodeTarget(merged.target, "target");
    } else {
      merged.target = "";
    }
  }
  if (type === "VoucherOffer") {
    validateObjectIdProp(merged.voucherId, "voucherId", { required: true });
    if (merged.ctaUrl) {
      merged.ctaUrl = validateHttpUrlWithHost(merged.ctaUrl, "ctaUrl");
      validateTextValue(merged.ctaUrl, { maxLength: 2048 }, "ctaUrl", { httpUrl: true });
    }
  }
  if (type === "SocialLinks") {
    const platforms = merged.platforms;
    if (platforms && typeof platforms === "object" && !Array.isArray(platforms)) {
      for (const key of Object.keys(platforms)) {
        if (key === "__proto__" || key === "constructor") {
          throw new ComponentConfigError(`Invalid prop at platforms.${key}`, {
            code: "invalid_component_config",
            details: { field: `platforms.${key}` },
          });
        }
      }
    }
  }

  const stripped = stripPropsAgainstFields(entry.fields, merged);
  const withId = props?.id ? { ...stripped, id: props.id } : stripped;
  const sectionData = propsToSectionData(withId);

  const sizeBytes = configSizeBytes(sectionData);
  if (sizeBytes > MAX_CONFIG_BYTES) {
    throw new ComponentConfigError("Component props exceed size limit", {
      code: "component_config_too_large",
      details: { maxBytes: MAX_CONFIG_BYTES, sizeBytes },
    });
  }

  return sectionData;
}

function validateComponentConfig(typeOrLegacyId, configOrProps) {
  return validateComponentProps(typeOrLegacyId, configOrProps);
}

module.exports = {
  ComponentConfigError,
  MAX_CONFIG_BYTES,
  getConfigJsonSchema,
  validateComponentProps,
  validateComponentConfig,
  normalizeQrCodeTarget,
  validateHttpUrlWithHost,
  validateSameSitePath,
};