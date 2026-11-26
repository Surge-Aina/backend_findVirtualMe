/**
 * Maps Puck component props (componentRegistry fields) ↔ portfolio section.data
 * consumed by unified block renderers and legacy section editors.
 *
 * Mirrors frontend featureComponentAdapters.js (Puck MIT patterns; not vendored).
 */

const DEFAULT_FORM_FIELDS = Object.freeze({
  showName: true,
  showEmail: true,
  showMessage: true,
});

function copyJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function preserveEditorMeta(existing = {}) {
  const preserved = {};
  if (existing.pageBanner !== undefined) preserved.pageBanner = copyJson(existing.pageBanner);
  if (existing.editorDisplayLabel !== undefined) {
    preserved.editorDisplayLabel = existing.editorDisplayLabel;
  }
  return preserved;
}

function scheduleEntryLabel(entry) {
  const day = String(entry?.day || "").trim().toLowerCase();
  if (!day) return null;
  if (day.startsWith("weekday") || day === "weekdays") return "weekdays";
  if (day.startsWith("sat")) return "saturday";
  if (day.startsWith("sun")) return "sunday";
  if (["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day)) return "weekdays";
  return null;
}

function formatScheduleSlot(entry) {
  if (!entry) return "";
  if (entry.closed) return "Closed";
  const open = String(entry.open || "").trim();
  const close = String(entry.close || "").trim();
  if (open && close) return `${open} – ${close}`;
  return open || close || "";
}

function isPuckGalleryShape(data) {
  return Array.isArray(data?.images) && !Array.isArray(data?.facilityImages) && !Array.isArray(data?.items);
}

function isPuckHoursShape(data) {
  return Array.isArray(data?.schedule);
}

function isPuckTestimonialsShape(data) {
  const items = data?.items;
  if (!Array.isArray(items) || !items.length) return false;
  return items.some((item) => item?.author !== undefined && item?.name === undefined);
}

function contactSectionToPuck(sectionData = {}) {
  const headline =
    sectionData.headline ||
    sectionData.title ||
    sectionData.formTitle ||
    "Get in touch";
  return {
    headline,
    enableForm: sectionData.enableForm !== false,
    submitLabel:
      sectionData.submitLabel ||
      sectionData.submitText ||
      "Send message",
    formFields: {
      ...DEFAULT_FORM_FIELDS,
      ...(sectionData.formFields || {}),
    },
  };
}

function contactPuckToSection(puckProps = {}, existing = {}) {
  const submit = puckProps.submitLabel || existing.submitText || "Send message";
  return {
    ...preserveEditorMeta(existing),
    ...existing,
    headline: puckProps.headline,
    title: puckProps.headline || existing.title,
    formTitle: puckProps.headline || existing.formTitle,
    submitLabel: submit,
    submitText: submit,
    enableForm: puckProps.enableForm !== false,
    formFields: {
      ...DEFAULT_FORM_FIELDS,
      ...(puckProps.formFields || {}),
    },
  };
}

function gallerySectionToPuck(sectionData = {}, template) {
  if (isPuckGalleryShape(sectionData)) {
    return {
      title: sectionData.title || "Gallery",
      images: copyJson(sectionData.images) || [],
    };
  }

  if (template === "handyman") {
    const images = (sectionData.items || [])
      .map((item) => {
        const url =
          item?.imageUrl ||
          item?.beforeImageUrl ||
          item?.afterImageUrl ||
          item?.url ||
          "";
        if (!String(url).trim()) return null;
        return {
          url: String(url).trim(),
          caption: item?.title || item?.subtitle || item?.caption || "",
        };
      })
      .filter(Boolean);
    return {
      title: sectionData.sectionTitle || "Gallery",
      images,
    };
  }

  const images = (sectionData.facilityImages || []).map(({ url, caption }) => ({
    url: url || "",
    caption: caption || "",
  }));

  return {
    title: sectionData.sectionTitle || sectionData.title || "Gallery",
    images,
  };
}

function galleryPuckToSection(puckProps = {}, existing = {}, template) {
  const title = puckProps.title || existing.sectionTitle || "Gallery";
  const images = Array.isArray(puckProps.images) ? puckProps.images : [];

  if (template === "handyman") {
    const items = images.map((img, index) => {
      const prior = existing.items?.[index] || {};
      return {
        ...prior,
        title: img.caption || prior.title || "",
        imageUrl: img.url || prior.imageUrl || "",
      };
    });
    const merged = {
      ...preserveEditorMeta(existing),
      ...existing,
      sectionTitle: title,
      items,
    };
    delete merged.title;
    delete merged.images;
    return merged;
  }

  const merged = {
    ...preserveEditorMeta(existing),
    ...existing,
    sectionTitle: title,
    facilityImages: images.map(({ url, caption }) => ({
      url: url || "",
      caption: caption || "",
    })),
  };
  delete merged.title;
  delete merged.images;
  return merged;
}

function isPuckServicesShape(sectionData) {
  return sectionData?.title !== undefined && sectionData?.sectionTitle === undefined;
}

function servicesSectionToPuck(sectionData = {}) {
  if (isPuckServicesShape(sectionData)) {
    return {
      title: sectionData.title || "Our services",
      items: copyJson(sectionData.items) || [],
    };
  }

  return {
    title: sectionData.sectionTitle || "Our services",
    items: (sectionData.items || []).map((item) => ({
      title: item?.title || "",
      description: item?.description || "",
    })),
  };
}

function servicesPuckToSection(puckProps = {}, existing = {}) {
  const title = puckProps.title || existing.sectionTitle || "Our services";
  const items = (puckProps.items || []).map((item, index) => ({
    ...(existing.items?.[index] || {}),
    title: item?.title || "",
    description: item?.description || "",
  }));
  const merged = {
    ...preserveEditorMeta(existing),
    ...existing,
    sectionTitle: title,
    items,
  };
  delete merged.title;
  return merged;
}

function testimonialsSectionToPuck(sectionData = {}) {
  if (isPuckTestimonialsShape(sectionData)) {
    return {
      title: sectionData.title || "What clients say",
      items: copyJson(sectionData.items) || [],
    };
  }

  return {
    title: sectionData.sectionTitle || sectionData.title || "What clients say",
    items: (sectionData.items || []).map((item) => ({
      author: item?.name || item?.author || "",
      quote: item?.quote || "",
      rating: item?.rating ?? 5,
    })),
  };
}

function testimonialsPuckToSection(puckProps = {}, existing = {}) {
  const title = puckProps.title || existing.sectionTitle || "What clients say";
  const items = (puckProps.items || []).map((item, index) => ({
    ...(existing.items?.[index] || {}),
    name: item?.author || "",
    quote: item?.quote || "",
    rating: item?.rating ?? 5,
  }));
  const merged = {
    ...preserveEditorMeta(existing),
    ...existing,
    sectionTitle: title,
    items,
  };
  delete merged.title;
  return merged;
}

function hoursSectionToPuck(sectionData = {}) {
  if (isPuckHoursShape(sectionData)) {
    return {
      title: sectionData.title || "Hours",
      timezone: sectionData.timezone || "America/New_York",
      schedule: copyJson(sectionData.schedule) || [],
    };
  }

  const schedule = [];
  if (sectionData.weekdays) {
    schedule.push({
      day: "Weekdays",
      open: sectionData.weekdays,
      close: "",
      closed: false,
    });
  }
  if (sectionData.saturday) {
    schedule.push({
      day: "Saturday",
      open: sectionData.saturday,
      close: "",
      closed: false,
    });
  }
  if (sectionData.sunday) {
    schedule.push({
      day: "Sunday",
      open: sectionData.sunday,
      close: "",
      closed: false,
    });
  }

  return {
    title: sectionData.title || "Hours",
    timezone: sectionData.timezone || "America/New_York",
    schedule,
  };
}

function hoursPuckToSection(puckProps = {}, existing = {}) {
  const next = {
    ...preserveEditorMeta(existing),
    ...existing,
    title: puckProps.title || existing.title,
    timezone: puckProps.timezone || existing.timezone,
  };

  const buckets = { weekdays: "", saturday: "", sunday: "" };
  for (const entry of puckProps.schedule || []) {
    const bucket = scheduleEntryLabel(entry);
    if (!bucket) continue;
    const formatted = formatScheduleSlot(entry);
    if (!formatted) continue;
    if (bucket === "weekdays") buckets.weekdays = formatted;
    else buckets[bucket] = formatted;
  }

  if (buckets.weekdays) next.weekdays = buckets.weekdays;
  if (buckets.saturday) next.saturday = buckets.saturday;
  if (buckets.sunday) next.sunday = buckets.sunday;

  delete next.schedule;
  return next;
}

const SOCIAL_PLATFORM_KEYS = ["github", "twitter", "linkedin", "instagram", "website"];

const DEFAULT_SOCIAL_PLATFORMS = Object.freeze({
  github: true,
  twitter: true,
  linkedin: true,
  instagram: false,
  website: true,
});

function stripSocialUrlFields(obj = {}) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SOCIAL_PLATFORM_KEYS.includes(key) && typeof value === "string") continue;
    if (key === "links" && typeof value === "object") continue;
    out[key] = value;
  }
  return out;
}

function normalizePlatformFlags(platforms = {}) {
  const out = { ...DEFAULT_SOCIAL_PLATFORMS };
  for (const key of SOCIAL_PLATFORM_KEYS) {
    if (platforms[key] === true || platforms[key] === false) {
      out[key] = platforms[key];
    }
  }
  return out;
}

function socialLinksSectionToPuck(sectionData = {}) {
  const title = sectionData.sectionTitle || sectionData.title || "Connect";
  const platforms = normalizePlatformFlags(sectionData.platforms || sectionData.showPlatforms || {});
  return { title, platforms };
}

function socialLinksPuckToSection(puckProps = {}, existing = {}) {
  const title = puckProps.title || existing.sectionTitle || "Connect";
  const merged = {
    ...preserveEditorMeta(existing),
    ...stripSocialUrlFields(existing),
    sectionTitle: title,
    platforms: normalizePlatformFlags(puckProps.platforms),
    linkSource: "socialLinksModule",
  };
  delete merged.title;
  delete merged.showPlatforms;
  delete merged.links;
  for (const key of SOCIAL_PLATFORM_KEYS) {
    delete merged[key];
  }
  return merged;
}

function qrCodeSectionToPuck(sectionData = {}) {
  return {
    title: sectionData.sectionTitle || sectionData.title || "Scan to visit",
    target: sectionData.target || "",
    size: sectionData.size ?? 160,
    caption: sectionData.caption || "",
  };
}

function qrCodePuckToSection(puckProps = {}, existing = {}) {
  const merged = {
    ...preserveEditorMeta(existing),
    ...existing,
    sectionTitle: puckProps.title || existing.sectionTitle || "Scan to visit",
    target: puckProps.target ?? existing.target ?? "",
    size: puckProps.size ?? existing.size ?? 160,
    caption: puckProps.caption || existing.caption || "",
  };
  delete merged.title;
  return merged;
}

function voucherOfferSectionToPuck(sectionData = {}) {
  return {
    title: sectionData.sectionTitle || sectionData.title || "Special offer",
    voucherId: sectionData.userVoucherId || sectionData.voucherId || "",
    description: sectionData.description || "",
    cta: sectionData.cta || sectionData.ctaLabel || "Learn more",
    ctaUrl: sectionData.ctaUrl || "",
  };
}

function voucherOfferPuckToSection(puckProps = {}, existing = {}) {
  const voucherId = puckProps.voucherId || existing.userVoucherId || existing.voucherId || "";
  const merged = {
    ...preserveEditorMeta(existing),
    ...existing,
    sectionTitle: puckProps.title || existing.sectionTitle || "Special offer",
    userVoucherId: voucherId,
    description: puckProps.description || "",
    cta: puckProps.cta || "Learn more",
    ctaUrl: puckProps.ctaUrl || "",
  };
  delete merged.title;
  delete merged.voucherId;
  delete merged.code;
  delete merged.redemptionCount;
  return merged;
}

const ADAPTERS = {
  ContactLeadForm: {
    toPuck: contactSectionToPuck,
    toSection: contactPuckToSection,
  },
  Gallery: {
    toPuck: gallerySectionToPuck,
    toSection: galleryPuckToSection,
  },
  Services: {
    toPuck: servicesSectionToPuck,
    toSection: servicesPuckToSection,
  },
  Testimonials: {
    toPuck: testimonialsSectionToPuck,
    toSection: testimonialsPuckToSection,
  },
  BusinessHours: {
    toPuck: hoursSectionToPuck,
    toSection: hoursPuckToSection,
  },
  SocialLinks: {
    toPuck: socialLinksSectionToPuck,
    toSection: socialLinksPuckToSection,
  },
  QrCode: {
    toPuck: qrCodeSectionToPuck,
    toSection: qrCodePuckToSection,
  },
  VoucherOffer: {
    toPuck: voucherOfferSectionToPuck,
    toSection: voucherOfferPuckToSection,
  },
};

function sectionDataToPuckProps(puckType, sectionData, template) {
  const adapter = ADAPTERS[puckType];
  if (!adapter) return copyJson(sectionData) || {};
  if (puckType === "Gallery") return adapter.toPuck(sectionData || {}, template);
  return adapter.toPuck(sectionData || {});
}

function puckPropsToSectionData(puckType, puckProps, template, existingSectionData = {}) {
  const adapter = ADAPTERS[puckType];
  const stripped = { ...puckProps };
  delete stripped.id;
  if (!adapter) return { ...existingSectionData, ...stripped };
  if (puckType === "Gallery") return adapter.toSection(stripped, existingSectionData, template);
  return adapter.toSection(stripped, existingSectionData);
}

module.exports = {
  sectionDataToPuckProps,
  puckPropsToSectionData,
  contactSectionToPuck,
  contactPuckToSection,
  gallerySectionToPuck,
  galleryPuckToSection,
  servicesSectionToPuck,
  servicesPuckToSection,
  testimonialsSectionToPuck,
  testimonialsPuckToSection,
  hoursSectionToPuck,
  hoursPuckToSection,
  socialLinksSectionToPuck,
  socialLinksPuckToSection,
  qrCodeSectionToPuck,
  qrCodePuckToSection,
  voucherOfferSectionToPuck,
  voucherOfferPuckToSection,
};