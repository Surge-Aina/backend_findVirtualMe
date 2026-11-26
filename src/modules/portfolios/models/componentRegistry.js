const { BLOCK_TYPES } = require("./blockTypes");

/**
 * Feature component registry shaped for Puck (https://github.com/puckeditor/puck, MIT).
 * Each entry is a serializable ComponentConfig (fields, defaultProps, label; no render).
 * Client apps supply render() when passing config to <Puck /> or <Render />.
 */
const UNIFIED_SITE_TEMPLATES = Object.freeze([
  "healthcare",
  "handyman",
  "projectManager",
  "dataScientist",
  "agent",
]);

const REGISTRY_VERSION = "1.0.0";

const PUCK_REFERENCE = Object.freeze({
  name: "Puck",
  url: "https://github.com/puckeditor/puck",
  license: "MIT",
  docs: "https://puckeditor.com/docs/api-reference/configuration/component-config",
});

const LEGACY_TYPE_ALIASES = Object.freeze({
  contactLeadForm: "ContactLeadForm",
  gallery: "Gallery",
  services: "Services",
  testimonials: "Testimonials",
  businessHours: "BusinessHours",
});

const ROOT_CONFIG = Object.freeze({
  label: "Page",
  fields: {
    title: { type: "text", label: "Page title" },
  },
  defaultProps: {
    title: "",
  },
});

/**
 * Puck `config.components` for unified templates.
 * `metadata.blockType` is the portfolio section.type persisted in MongoDB.
 */
const PUCK_COMPONENTS = Object.freeze({
  ContactLeadForm: {
    label: "Contact / lead form",
    fields: {
      headline: { type: "text", label: "Headline" },
      enableForm: {
        type: "radio",
        label: "Lead form",
        options: [
          { label: "Show form", value: true },
          { label: "Hide form", value: false },
        ],
      },
      submitLabel: { type: "text", label: "Submit button label" },
      formFields: {
        type: "object",
        label: "Visible fields",
        objectFields: {
          showName: {
            type: "radio",
            label: "Name field",
            options: [
              { label: "Show", value: true },
              { label: "Hide", value: false },
            ],
          },
          showEmail: {
            type: "radio",
            label: "Email field",
            options: [
              { label: "Show", value: true },
              { label: "Hide", value: false },
            ],
          },
          showMessage: {
            type: "radio",
            label: "Message field",
            options: [
              { label: "Show", value: true },
              { label: "Hide", value: false },
            ],
          },
        },
      },
    },
    defaultProps: {
      headline: "Get in touch",
      enableForm: true,
      submitLabel: "Send message",
      formFields: {
        showName: true,
        showEmail: true,
        showMessage: true,
      },
    },
    metadata: {
      blockType: "contact",
      submissionEndpoint: "/api/contact",
    },
  },
  Gallery: {
    label: "Gallery",
    fields: {
      title: { type: "text", label: "Title" },
      images: {
        type: "array",
        label: "Images",
        min: 0,
        max: 48,
        arrayFields: {
          url: { type: "text", label: "Image URL" },
          caption: { type: "textarea", label: "Caption" },
        },
        defaultItemProps: {
          url: "",
          caption: "",
        },
      },
    },
    defaultProps: {
      title: "Gallery",
      images: [],
    },
    metadata: {
      blockType: "gallery",
    },
  },
  Services: {
    label: "Services",
    fields: {
      title: { type: "text", label: "Title" },
      items: {
        type: "array",
        label: "Services",
        min: 0,
        max: 32,
        arrayFields: {
          title: { type: "text", label: "Name" },
          description: { type: "textarea", label: "Description" },
        },
        defaultItemProps: {
          title: "New service",
          description: "",
        },
      },
    },
    defaultProps: {
      title: "Our services",
      items: [],
    },
    metadata: {
      blockType: "services",
    },
  },
  Testimonials: {
    label: "Testimonials",
    fields: {
      title: { type: "text", label: "Title" },
      items: {
        type: "array",
        label: "Testimonials",
        min: 0,
        max: 32,
        arrayFields: {
          author: { type: "text", label: "Author" },
          quote: { type: "textarea", label: "Quote" },
          rating: { type: "number", label: "Rating (1–5)", min: 1, max: 5 },
        },
        defaultItemProps: {
          author: "",
          quote: "",
          rating: 5,
        },
      },
    },
    defaultProps: {
      title: "What clients say",
      items: [],
    },
    metadata: {
      blockType: "testimonials",
    },
  },
  BusinessHours: {
    label: "Business hours",
    fields: {
      title: { type: "text", label: "Title" },
      timezone: { type: "text", label: "Timezone (IANA)" },
      schedule: {
        type: "array",
        label: "Weekly schedule",
        min: 0,
        max: 7,
        arrayFields: {
          day: { type: "text", label: "Day" },
          open: { type: "text", label: "Opens" },
          close: { type: "text", label: "Closes" },
          closed: {
            type: "radio",
            label: "Closed",
            options: [
              { label: "Closed", value: true },
              { label: "Open", value: false },
            ],
          },
        },
        defaultItemProps: {
          day: "Monday",
          open: "09:00",
          close: "17:00",
          closed: false,
        },
      },
    },
    defaultProps: {
      title: "Hours",
      timezone: "America/New_York",
      schedule: [],
    },
    metadata: {
      blockType: "hours",
    },
  },
});

const PUCK_COMPONENT_TYPES = Object.freeze(Object.keys(PUCK_COMPONENTS));

const PUCK_TYPE_SET = new Set(PUCK_COMPONENT_TYPES);

function normalizePuckType(typeOrLegacyId) {
  if (typeof typeOrLegacyId !== "string") return null;
  const trimmed = typeOrLegacyId.trim();
  if (PUCK_TYPE_SET.has(trimmed)) return trimmed;
  return LEGACY_TYPE_ALIASES[trimmed] || null;
}

function isFeatureComponentId(typeOrLegacyId) {
  return Boolean(normalizePuckType(typeOrLegacyId));
}

function blockTypeForComponent(typeOrLegacyId) {
  const type = normalizePuckType(typeOrLegacyId);
  if (!type) return null;
  return PUCK_COMPONENTS[type]?.metadata?.blockType || null;
}

function componentIdForBlockType(blockType) {
  for (const type of PUCK_COMPONENT_TYPES) {
    if (PUCK_COMPONENTS[type].metadata?.blockType === blockType) return type;
  }
  return null;
}

function isUnifiedTemplate(template) {
  return UNIFIED_SITE_TEMPLATES.includes(template);
}

function serializeComponentConfigForApi(entry, type) {
  const blockType = entry.metadata?.blockType;
  const blockMeta = blockType ? BLOCK_TYPES[blockType] : null;
  const { metadata, ...rest } = entry;
  return {
    ...rest,
    metadata: {
      ...metadata,
      version: REGISTRY_VERSION,
      templates: [...UNIFIED_SITE_TEMPLATES],
      blockLabel: blockMeta?.label,
    },
    type,
  };
}

function buildPuckConfig() {
  const components = {};
  for (const type of PUCK_COMPONENT_TYPES) {
    components[type] = serializeComponentConfigForApi(PUCK_COMPONENTS[type], type);
  }
  return {
    root: { ...ROOT_CONFIG },
    components,
  };
}

function listComponentsForTemplate(template) {
  if (!isUnifiedTemplate(template)) {
    return [];
  }
  const config = buildPuckConfig();
  return PUCK_COMPONENT_TYPES.map((type) => ({
    type,
    ...config.components[type],
  }));
}

module.exports = {
  UNIFIED_SITE_TEMPLATES,
  REGISTRY_VERSION,
  PUCK_REFERENCE,
  LEGACY_TYPE_ALIASES,
  ROOT_CONFIG,
  PUCK_COMPONENTS,
  PUCK_COMPONENT_TYPES,
  normalizePuckType,
  isFeatureComponentId,
  blockTypeForComponent,
  componentIdForBlockType,
  isUnifiedTemplate,
  buildPuckConfig,
  listComponentsForTemplate,
};