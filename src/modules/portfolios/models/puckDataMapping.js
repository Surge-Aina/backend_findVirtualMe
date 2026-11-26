const {
  componentIdForBlockType,
  PUCK_REFERENCE,
  buildPuckConfig,
} = require("./componentRegistry");

/**
 * How Puck `Data` maps to FindVirtualMe portfolio documents (sections model).
 * Exposed verbatim on GET /api/portfolios/components for editor clients.
 */
const DATA_MAPPING = Object.freeze({
  summary:
    "Portfolio sections are the source of truth. Puck Data is a serialized view for editors; API/MCP writes accept Puck props and persist section.data.",
  puckReference: PUCK_REFERENCE,
  dataShape: {
    content: "Ordered list of ComponentData; maps 1:1 to portfolio sections filtered to feature components.",
    root: "root.props maps to site-level fields (e.g. title) on publish; not mutated by sites:write in v1.",
    zones: "Always {} for v1 (flat content). Puck slots may be adopted later.",
  },
  contentItem: {
    type: "Puck component type (config.components key). Registry metadata.blockType is stored as section.type.",
    "props.id": "Mirrors section._id as a string.",
    "props.*": "All other props are stored in section.data without transformation.",
  },
  section: {
    type: "blockType from registry metadata (e.g. contact, gallery).",
    order: "Display order; reorder_components updates order on matching sections only.",
    visible: "Section visibility flag (outside Puck props in this slice).",
    data: "Puck props minus id.",
  },
  contactLeadForm:
    "Public visitors submit leads via POST /api/contact (unchanged). Puck props configure the on-page form UI only.",
});

function sectionIdStr(section) {
  return section?._id?.toString?.() || "";
}

function sectionToComponentData(section) {
  const puckType = componentIdForBlockType(section.type);
  if (!puckType) return null;
  const data = section.data && typeof section.data === "object" ? section.data : {};
  return {
    type: puckType,
    props: {
      id: sectionIdStr(section) || undefined,
      ...JSON.parse(JSON.stringify(data)),
    },
  };
}

function sectionsToPuckData(sections, { title = "" } = {}) {
  const ordered = [...(sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const content = ordered.map(sectionToComponentData).filter(Boolean);

  return {
    content,
    root: { props: { title: title || "" } },
    zones: {},
  };
}

function propsToSectionData(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    return {};
  }
  const out = { ...props };
  delete out.id;
  return out;
}

function buildOwnerComponentsPayload({ template, sections, title }) {
  return {
    reference: PUCK_REFERENCE,
    config: buildPuckConfig(),
    dataMapping: DATA_MAPPING,
    data: sectionsToPuckData(sections, { title }),
    template,
  };
}

module.exports = {
  DATA_MAPPING,
  sectionToComponentData,
  sectionsToPuckData,
  propsToSectionData,
  buildOwnerComponentsPayload,
  sectionIdStr,
};