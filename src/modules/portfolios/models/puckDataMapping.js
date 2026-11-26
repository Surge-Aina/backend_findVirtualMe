const {
  componentIdForBlockType,
  PUCK_REFERENCE,
  buildPuckConfig,
} = require("./componentRegistry");
const { sectionDataToPuckProps, puckPropsToSectionData } = require("./featureComponentAdapters");

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
    "props.*":
      "Serialized Puck view; API/MCP reads convert legacy section.data to Puck props. Writes validate Puck props then persist legacy section.data.",
  },
  section: {
    type: "blockType from registry metadata (e.g. contact, gallery).",
    order: "Display order; reorder_components updates order on matching sections only.",
    visible: "Section visibility flag (outside Puck props in this slice).",
    data: "Legacy block fields in section.data; mirrors frontend unified block renderers.",
  },
  contactLeadForm:
    "Public visitors submit leads via POST /api/contact (unchanged). Puck props configure the on-page form UI only.",
  socialLinks:
    "Section data stores title + platform visibility only. URLs come from GET /api/social-links/:portfolioId with portfolio.socialLinks fallback; component writes cannot set URLs.",
  qrCode:
    "Section data stores title, target (empty = site URL, /path, or https URL per qr-code module rules), size, and caption.",
  voucherOffer:
    "Section data stores presentation fields plus userVoucherId (Puck props.voucherId). Voucher codes and redemption counts are never persisted or returned in component props.",
  bookingRequest:
    "Visitors submit POST /api/booking-requests (when FEATURE_COMPONENT_BOOKING_ENABLED). Stored as leads with leadType booking plus service and requested window.",
});

function sectionIdStr(section) {
  return section?._id?.toString?.() || "";
}

function sectionToComponentData(section, template) {
  const puckType = componentIdForBlockType(section.type);
  if (!puckType) return null;
  const data = section.data && typeof section.data === "object" ? section.data : {};
  const puckProps = sectionDataToPuckProps(puckType, data, template);
  return {
    type: puckType,
    props: {
      id: sectionIdStr(section) || undefined,
      ...JSON.parse(JSON.stringify(puckProps)),
    },
  };
}

function sectionsToPuckData(sections, { title = "", template } = {}) {
  const ordered = [...(sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const content = ordered.map((s) => sectionToComponentData(s, template)).filter(Boolean);

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
    data: sectionsToPuckData(sections, { title, template }),
    template,
  };
}

module.exports = {
  DATA_MAPPING,
  sectionToComponentData,
  sectionsToPuckData,
  propsToSectionData,
  puckPropsToSectionData,
  sectionDataToPuckProps,
  buildOwnerComponentsPayload,
  sectionIdStr,
};