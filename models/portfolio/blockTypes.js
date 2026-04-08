/**
 * Block type vocabulary for the sections/blocks portfolio architecture.
 *
 * Each key is a block type string stored in section.type.
 * The value describes the expected shape of section.data for that block,
 * which templates use it by default, and a human-readable label.
 *
 * Validation is intentionally loose (Schema.Types.Mixed) at the DB level —
 * this file serves as the application-layer contract.
 */

const BLOCK_TYPES = {
  hero: {
    label: "Hero",
    description: "Primary hero/banner section at the top of the portfolio",
    templates: ["healthcare", "handyman", "projectManager", "dataScientist"],
  },

  summary: {
    label: "Summary",
    description: "Personal summary with name, title, bio, profile image",
    templates: ["projectManager", "dataScientist"],
  },

  stats: {
    label: "Statistics",
    description: "Key metrics/stats displayed as counters",
    templates: ["healthcare"],
  },

  services: {
    label: "Services",
    description: "List of services or offerings",
    templates: ["healthcare", "handyman"],
  },

  skills: {
    label: "Skills",
    description: "List of skills or competencies",
    templates: ["projectManager", "dataScientist"],
  },

  experience: {
    label: "Experience",
    description: "Work experience timeline",
    templates: ["projectManager", "dataScientist"],
  },

  education: {
    label: "Education",
    description: "Education history",
    templates: ["projectManager", "dataScientist"],
  },

  projects: {
    label: "Projects",
    description: "Portfolio of projects with links",
    templates: ["projectManager", "dataScientist"],
  },

  gallery: {
    label: "Gallery",
    description: "Image gallery, optionally with before/after pairs",
    templates: ["healthcare", "handyman", "dataScientist"],
  },

  blog: {
    label: "Blog",
    description: "Blog posts listing",
    templates: ["healthcare", "dataScientist"],
  },

  testimonials: {
    label: "Testimonials",
    description: "Client testimonials / reviews",
    templates: ["handyman"],
  },

  process: {
    label: "Process Steps",
    description: "Step-by-step process or workflow",
    templates: ["handyman"],
  },

  contact: {
    label: "Contact",
    description: "Contact information and/or contact form",
    templates: ["healthcare", "handyman", "projectManager", "dataScientist"],
  },

  hours: {
    label: "Business Hours",
    description: "Operating hours for the business",
    templates: ["healthcare"],
  },

  seo: {
    label: "SEO",
    description: "SEO metadata (not visibly rendered, applied to page head)",
    templates: ["healthcare"],
  },
  dashboardChart: {
    label: "Dashboard Chart",
    description: "chart for displaying data",
    templates: ["dataScientist"],
  },
  dashboardTable: {
    label: "Dashboard Table",
    description: "table for displaying data",
    templates: ["dataScientist"],
  },
  faq: {
    label: "FAQ",
    description: "Frequently asked questions with concise answers",
    templates: ["agent"],
  },
  clientLogos: {
    label: "Client Logos",
    description: "Trusted-by logo strip or partner logo cloud",
    templates: ["agent"],
  },
  certifications: {
    label: "Certifications",
    description: "Credentials, licenses, and professional certifications",
    templates: ["agent"],
  },
  languages: {
    label: "Languages",
    description: "Spoken languages and proficiency levels",
    templates: ["agent"],
  },
  team: {
    label: "Team",
    description: "Team roster for studios, agencies, or collectives",
    templates: ["agent"],
  },
  videoEmbed: {
    label: "Video Embed",
    description: "Embedded reel, talk, or featured video section",
    templates: ["agent"],
  },
  caseStudy: {
    label: "Case Study",
    description: "Case study with challenge, solution, and outcome",
    templates: ["agent","projectManager","dataScientist"],
  },
};

for (const meta of Object.values(BLOCK_TYPES)) {
  if (!meta.templates.includes("agent")) {
    meta.templates.push("agent");
  }
}

const KNOWN_BLOCK_TYPES = Object.keys(BLOCK_TYPES);

function isKnownBlockType(type) {
  return KNOWN_BLOCK_TYPES.includes(type);
}

function getBlockTypesForTemplate(template) {
  return Object.entries(BLOCK_TYPES)
    .filter(([, meta]) => meta.templates.includes(template))
    .map(([type, meta]) => ({ type, ...meta }));
}

module.exports = {
  BLOCK_TYPES,
  KNOWN_BLOCK_TYPES,
  isKnownBlockType,
  getBlockTypesForTemplate,
};
