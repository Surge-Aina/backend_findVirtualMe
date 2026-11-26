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

function validateTextValue(value, field, path, { required = false } = {}) {
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

function validateFieldValue(field, value, path, { required = false } = {}) {
  switch (field.type) {
    case "text":
    case "textarea":
      validateTextValue(value, field, path, { required });
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
        if (sub) validateFieldValue(sub, value[key], `${path}.${key}`);
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
              required: sub.type === "text" && arrayFields[key] === sub,
            });
          }
        }
        for (const [key, sub] of Object.entries(arrayFields)) {
          if (sub.type === "text" && item[key] === undefined && false) {
            // optional text in array rows
          }
        }
        if (arrayFields.title && item.title !== undefined) {
          validateTextValue(item.title, arrayFields.title, `${itemPath}.title`, { required: true });
        }
        if (arrayFields.url && item.url !== undefined) {
          validateTextValue(item.url, { ...arrayFields.url, maxLength: 2048 }, `${itemPath}.url`, {
            required: true,
          });
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

/**
 * Validate Puck-style props for a component type (server-side mirror of Puck field types).
 */
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
  const sectionData = propsToSectionData(merged);

  const sizeBytes = configSizeBytes(sectionData);
  if (sizeBytes > MAX_CONFIG_BYTES) {
    throw new ComponentConfigError("Component props exceed size limit", {
      code: "component_config_too_large",
      details: { maxBytes: MAX_CONFIG_BYTES, sizeBytes },
    });
  }

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

  return sectionData;
}

/** @deprecated name kept for call sites — validates props, returns section.data */
function validateComponentConfig(typeOrLegacyId, configOrProps) {
  return validateComponentProps(typeOrLegacyId, configOrProps);
}

module.exports = {
  ComponentConfigError,
  MAX_CONFIG_BYTES,
  getConfigJsonSchema,
  validateComponentProps,
  validateComponentConfig,
};