const crypto = require("crypto");
const OpenAI = require("openai");

const { getBlockTypesForTemplate } = require("../models/portfolio/blockTypes");
const {
  createAgentPortfolio,
  PortfolioValidationError,
  getClosestKnownBlocks,
} = require("./portfolio.service");

const OPENAI_MODEL = "gpt-4o-mini";
const GENERATION_VERSION = "2026-03-25";
const DEFAULT_THEME = "aurora";
/** Must match keys in frontend `AGENT_THEME_PRESETS` (agentThemeResolver.js). */
const ALLOWED_THEMES = [
  "aurora",
  "clay",
  "forest",
  "midnight",
  "ocean",
  "paper",
  "rose",
  "slate",
  "sunrise",
];
const UNSUPPORTED_HINTS = [
  {
    label: "booking calendar",
    tokens: ["booking", "appointment", "calendar", "schedule"],
    threshold: 2,
  },
  {
    label: "checkout flow",
    tokens: ["checkout", "cart", "payment", "storefront", "ecommerce"],
    threshold: 2,
  },
  {
    label: "user authentication",
    tokens: ["login", "sign up", "signup", "authentication", "account"],
    threshold: 2,
  },
  {
    label: "live chat",
    tokens: ["chat", "messaging", "inbox", "dm"],
    threshold: 2,
  },
];

const BLOCK_DATA_HINTS = {
  hero: {
    description: "Marketing hero/banner for service, studio, or branded portfolio prompts.",
    dataShape: {
      title: "Heading",
      subtitle: "Short supporting statement",
      description: "One short paragraph",
      ctaText: "Primary CTA",
      secondaryButtonText: "Secondary CTA",
      phoneNumber: "",
      imageUrl: "",
      badge1Text: "",
      badge2Text: "",
      badge3Text: "",
    },
  },
  summary: {
    description: "Personal or business summary with identity, role, and overview.",
    dataShape: {
      name: "Name or brand",
      title: "Professional title",
      bio: "Short bio",
      summary: "Short summary paragraph",
      email: "",
      phone: "",
      location: "",
      profileImage: "",
      resumeUrl: "",
    },
  },
  stats: {
    description: "A few metrics, counters, or performance highlights.",
    dataShape: {
      items: [
        { label: "Metric name", value: "42", suffix: "%", description: "Optional context" },
      ],
    },
  },
  services: {
    description: "Offerings, capabilities, or engagement packages.",
    dataShape: {
      sectionTitle: "Services",
      sectionIntro: "One short intro sentence",
      items: [
        {
          title: "Service title",
          description: "One short paragraph",
          features: ["Feature one", "Feature two"],
          bullets: ["Optional bullet"],
          price: "",
          duration: "",
          icon: "",
          image: "",
        },
      ],
    },
  },
  skills: {
    description: "Skills, tools, or areas of expertise.",
    dataShape: {
      items: [
        { name: "Skill", level: "Advanced", category: "Strategy" },
      ],
    },
  },
  experience: {
    description: "Career or project experience timeline.",
    dataShape: {
      items: [
        {
          company: "Company",
          title: "Role",
          location: "",
          startDate: "",
          endDate: "",
          description: "One short paragraph",
          achievements: ["Achievement"],
        },
      ],
    },
  },
  education: {
    description: "Formal education, certifications, or training.",
    dataShape: {
      items: [
        {
          school: "School",
          degree: "Degree",
          fieldOfStudy: "",
          startDate: "",
          endDate: "",
          description: "",
        },
      ],
    },
  },
  projects: {
    description: "Examples of work, case examples, or offerings.",
    dataShape: {
      items: [
        {
          name: "Project name",
          description: "One short paragraph",
          about: "",
          time: "",
          githubUrl: "",
          liveUrl: "",
          link: "",
        },
      ],
    },
  },
  gallery: {
    description: "Visual portfolio, before/after, or image showcase.",
    dataShape: {
      items: [
        { title: "Image caption", image: "https://example.com/image.jpg", description: "" },
      ],
    },
  },
  blog: {
    description: "Writing samples, insights, or article previews.",
    dataShape: {
      posts: [
        { title: "Post title", excerpt: "Short excerpt", slug: "", publishedAt: "" },
      ],
    },
  },
  testimonials: {
    description: "Client or collaborator proof points.",
    dataShape: {
      items: [
        { name: "Client", role: "Role", quote: "Short testimonial" },
      ],
    },
  },
  process: {
    description: "Step-by-step workflow or engagement path.",
    dataShape: {
      steps: [
        { title: "Step one", description: "One short sentence" },
      ],
    },
  },
  contact: {
    description: "Reach-out details and contact form copy.",
    dataShape: {
      title: "Let's connect",
      subtitle: "Short invitation",
      email: "",
      phone: "",
      location: "",
      website: "",
      hours: "",
      note: "",
    },
  },
  hours: {
    description: "Business availability.",
    dataShape: {
      title: "Hours",
      items: [
        { day: "Monday", open: "9:00 AM", close: "5:00 PM" },
      ],
    },
  },
  seo: {
    description: "Search metadata only when the prompt clearly implies discoverability content.",
    dataShape: {
      title: "SEO title",
      description: "SEO description",
      keywords: ["keyword"],
    },
  },
  dashboardChart: {
    description: "Simple metrics chart for analytics/data-science style prompts.",
    dataShape: {
      chartTitle: "Quarterly metrics",
      xAxisLabel: "Quarter",
      yAxisLabel: "Score",
      data: {
        sales: [12, 18, 26, 31],
        revenue: [22, 28, 34, 40],
        xLabels: ["Q1", "Q2", "Q3", "Q4"],
        hiddenPoints: [],
      },
      categories: ["Analysis", "Modeling", "Communication"],
      categoryData: [40, 35, 25],
      isActive: true,
    },
  },
  dashboardTable: {
    description: "Compact structured table for analytics or benchmark summaries.",
    dataShape: {
      tableTitle: "Capability snapshot",
      tableData: [
        { name: "Python", value: 95, percentage: 40, icon: "PY", link: "", buttonText: "" },
      ],
    },
  },
  faq: {
    description: "Frequently asked questions that reduce objections and explain how the work fits.",
    dataShape: {
      sectionTitle: "Frequently asked questions",
      sectionIntro: "Optional short intro",
      items: [
        {
          question: "Common question",
          answer: "Short, clear answer",
        },
      ],
    },
  },
  clientLogos: {
    description: "Logo strip or client cloud for trust, partner proof, or brands worked with.",
    dataShape: {
      sectionTitle: "Trusted by",
      sectionIntro: "Optional short credibility statement",
      items: [
        {
          name: "Client or partner",
          logoUrl: "https://example.com/logo.png",
          url: "",
        },
      ],
    },
  },
  certifications: {
    description: "Licenses, certifications, and credentials separate from formal education.",
    dataShape: {
      sectionTitle: "Certifications",
      items: [
        {
          name: "Certification name",
          issuer: "Issuing organization",
          credentialId: "",
          earnedDate: "",
          expiresDate: "",
          url: "",
        },
      ],
    },
  },
  languages: {
    description: "Spoken languages with proficiency to support international or multilingual positioning.",
    dataShape: {
      sectionTitle: "Languages",
      items: [
        {
          name: "English",
          proficiency: "Native",
        },
      ],
    },
  },
  team: {
    description: "Roster of team members for an agency, studio, or collective portfolio.",
    dataShape: {
      sectionTitle: "Team",
      sectionIntro: "Optional short intro",
      items: [
        {
          name: "Team member",
          role: "Role",
          bio: "Short bio",
          imageUrl: "",
          profileUrl: "",
        },
      ],
    },
  },
  videoEmbed: {
    description: "Featured reel, talk, or walkthrough using an embed URL or hosted video URL.",
    dataShape: {
      sectionTitle: "Featured video",
      title: "Video title",
      description: "Short context for the video",
      provider: "YouTube",
      embedUrl: "https://www.youtube.com/embed/example",
      videoUrl: "",
      posterImageUrl: "",
    },
  },
  caseStudy: {
    description: "Narrative challenge/solution/outcome proof.",
    dataShape: {
      title: "Case study title",
      client: "",
      industry: "",
      challenge: "Problem statement",
      solution: "What was done",
      outcome: "Result",
      metrics: ["Metric"],
      tools: ["Tool"],
      link: "",
    },
  },
};

let openaiClient = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hashPrompt(prompt) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function toTitleCase(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDisplayName(user = {}) {
  const firstName = cleanString(user.firstName);
  const lastName = cleanString(user.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || cleanString(user.name) || cleanString(user.email).split("@")[0] || "Your Name";
}

function buildTitleFromPrompt(prompt, fallbackName) {
  const trimmed = cleanString(prompt);
  if (!trimmed) return fallbackName || "AI Portfolio";
  const compact = trimmed.replace(/\s+/g, " ");
  if (compact.length <= 42) return toTitleCase(compact);
  return `${toTitleCase(compact.slice(0, 39))}...`;
}

function normalizeThemeId(themeId) {
  const cleaned = cleanString(themeId).toLowerCase();
  return ALLOWED_THEMES.includes(cleaned) ? cleaned : DEFAULT_THEME;
}

function inferThemeId(prompt) {
  const lower = cleanString(prompt).toLowerCase();
  if (/(minimal|editorial|paper|clean|light|airy)/.test(lower)) {
    return "paper";
  }
  if (/(warm|sunset|sunrise|hospitality|food|creative|bold)/.test(lower)) {
    return "sunrise";
  }
  if (/(forest|nature|organic|eco|sustainable|garden|woodland)/.test(lower)) {
    return "forest";
  }
  if (/(ocean|marine|coastal|nautical|aqua|seaside|underwater|beach)/.test(lower)) {
    return "ocean";
  }
  if (/(midnight|cosmic|galaxy|vaporwave|neon|purple|noir)/.test(lower)) {
    return "midnight";
  }
  if (/(clay|terracotta|earth|rustic|earthy|pottery)/.test(lower)) {
    return "clay";
  }
  if (/(slate|corporate|enterprise|formal|finance|banking|executive)/.test(lower)) {
    return "slate";
  }
  if (/(rose|blush|feminine|spa|wedding|bouquet)/.test(lower)) {
    return "rose";
  }
  return DEFAULT_THEME;
}

function buildSocialLinks(user = {}) {
  const socialLinks = {
    github: cleanString(user.github),
    linkedin: cleanString(user.linkedin),
    twitter: cleanString(user.twitter),
    instagram: cleanString(user.instagram),
    website: cleanString(user.website),
  };

  return Object.fromEntries(Object.entries(socialLinks).filter(([, value]) => value));
}

function findUnsupportedNeed(prompt) {
  const lower = cleanString(prompt).toLowerCase();
  if (!lower) return "";

  for (const hint of UNSUPPORTED_HINTS) {
    const hits = hint.tokens.reduce((count, token) => {
      return count + (lower.includes(token) ? 1 : 0);
    }, 0);
    if (hits >= hint.threshold) {
      return hint.label;
    }
  }

  return "";
}

function buildUnsupportedCapabilityError(requestedCapability, unsupportedNeed) {
  return new PortfolioValidationError(`Unsupported capability requested: ${unsupportedNeed}`, {
    code: "UNSUPPORTED_BLOCK_NEED",
    details: {
      blockType: unsupportedNeed,
      template: "agent",
      requestedCapability,
      closestKnownBlocks: getClosestKnownBlocks("agent", requestedCapability),
    },
  });
}

function buildBlockCatalogPrompt() {
  return getBlockTypesForTemplate("agent").map((block) => ({
    type: block.type,
    label: block.label,
    description: block.description,
    dataShape: BLOCK_DATA_HINTS[block.type]?.dataShape || {},
  }));
}

function buildUserContext(user = {}) {
  return {
    name: buildDisplayName(user),
    email: cleanString(user.email),
    phone: cleanString(user.phone),
    location: cleanString(user.location),
    bio: cleanString(user.bio),
    goal: cleanString(user.goal),
    industry: cleanString(user.industry),
    experienceLevel: cleanString(user.experienceLevel),
    skills: Array.isArray(user.skills) ? user.skills.filter(Boolean).slice(0, 12) : [],
    socialLinks: buildSocialLinks(user),
  };
}

function createSummarySection(prompt, userContext) {
  return {
    type: "summary",
    data: {
      name: userContext.name,
      title: userContext.goal || "Custom portfolio",
      bio:
        userContext.bio ||
        `Built from the prompt: "${cleanString(prompt).slice(0, 160)}"${cleanString(prompt).length > 160 ? "..." : ""}`,
      summary:
        userContext.industry || userContext.skills.length
          ? `${userContext.industry || "Professional"} portfolio highlighting ${userContext.skills.slice(0, 3).join(", ") || "selected strengths"}.`
          : "A custom portfolio assembled from reusable blocks and tailored to the requested direction.",
      email: userContext.email,
      phone: userContext.phone,
      location: userContext.location,
      profileImage: "",
      resumeUrl: "",
    },
  };
}

function createHeroSection(prompt, userContext) {
  return {
    type: "hero",
    data: {
      title: buildTitleFromPrompt(prompt, userContext.name),
      subtitle: userContext.goal || userContext.industry || "Custom portfolio",
      description:
        userContext.bio ||
        "A prompt-shaped portfolio designed to communicate value, credibility, and the next best action.",
      ctaText: "Get in touch",
      secondaryButtonText: "Explore work",
      phoneNumber: userContext.phone,
      imageUrl: "",
      badge1Text: userContext.experienceLevel || "",
      badge2Text: userContext.industry || "",
      badge3Text: userContext.skills[0] || "",
    },
  };
}

function createProjectsSection(prompt) {
  return {
    type: "projects",
    data: {
      items: [
        {
          name: "Featured project",
          description: `A representative example aligned with the prompt: "${cleanString(prompt).slice(0, 120)}"${cleanString(prompt).length > 120 ? "..." : ""}`,
          about: "Use the editor to replace this with your real work, links, and outcomes.",
          time: "Recent work",
          githubUrl: "",
          liveUrl: "",
          link: "",
        },
      ],
    },
  };
}

function createServicesSection(prompt) {
  return {
    type: "services",
    data: {
      sectionTitle: "What I Offer",
      sectionIntro: `A service mix inspired by: "${cleanString(prompt).slice(0, 110)}"${cleanString(prompt).length > 110 ? "..." : ""}`,
      items: [
        {
          title: "Core service",
          description: "Primary offer or capability highlighted by the prompt.",
          features: ["Scoping", "Delivery", "Clear outcomes"],
          price: "",
          duration: "",
          icon: "",
        },
        {
          title: "Strategy support",
          description: "Optional advisory, planning, or refinement support.",
          features: ["Recommendations", "Roadmap", "Next steps"],
          price: "",
          duration: "",
          icon: "",
        },
      ],
    },
  };
}

function createFaqSection() {
  return {
    type: "faq",
    data: {
      sectionTitle: "Frequently asked questions",
      sectionIntro: "Helpful answers that remove friction before the first conversation.",
      items: [
        {
          question: "What kinds of engagements are the best fit?",
          answer: "Add a concise answer that sets expectations and clarifies scope.",
        },
      ],
    },
  };
}

function createClientLogosSection() {
  return {
    type: "clientLogos",
    data: {
      sectionTitle: "Trusted by",
      sectionIntro: "Add clients, partners, or brands that strengthen credibility.",
      items: [
        {
          name: "Client name",
          logoUrl: "",
          url: "",
        },
      ],
    },
  };
}

function createCertificationsSection() {
  return {
    type: "certifications",
    data: {
      sectionTitle: "Certifications",
      items: [
        {
          name: "Certification name",
          issuer: "Issuing organization",
          credentialId: "",
          earnedDate: "",
          expiresDate: "",
          url: "",
        },
      ],
    },
  };
}

function createLanguagesSection() {
  return {
    type: "languages",
    data: {
      sectionTitle: "Languages",
      items: [
        {
          name: "English",
          proficiency: "Fluent",
        },
      ],
    },
  };
}

function createTeamSection() {
  return {
    type: "team",
    data: {
      sectionTitle: "Team",
      sectionIntro: "Introduce the people behind the delivery.",
      items: [
        {
          name: "Team member",
          role: "Role",
          bio: "Add a short bio describing this person's contribution.",
          imageUrl: "",
          profileUrl: "",
        },
      ],
    },
  };
}

function createVideoEmbedSection() {
  return {
    type: "videoEmbed",
    data: {
      sectionTitle: "Featured video",
      title: "Reel or walkthrough",
      description: "Add a featured video that helps visitors understand the work quickly.",
      provider: "",
      embedUrl: "",
      videoUrl: "",
      posterImageUrl: "",
    },
  };
}

function createCaseStudySection() {
  return {
    type: "caseStudy",
    data: {
      title: "Representative engagement",
      client: "",
      industry: "",
      challenge: "Summarize the starting challenge or opportunity.",
      solution: "Explain the approach, deliverable, or system that was created.",
      outcome: "Describe the result, business value, or user impact.",
      metrics: ["Add measurable impact"],
      tools: [],
      link: "",
    },
  };
}

function createContactSection(userContext) {
  return {
    type: "contact",
    data: {
      title: "Let's connect",
      subtitle: "Start a conversation about this portfolio direction.",
      email: userContext.email,
      phone: userContext.phone,
      location: userContext.location,
      website: userContext.socialLinks.website || "",
      hours: "",
      note: "",
    },
  };
}

function createSkillsSection(userContext) {
  return {
    type: "skills",
    data: {
      items: userContext.skills.length
        ? userContext.skills.slice(0, 8).map((skill) => ({
            name: skill,
            level: "Strong",
            category: userContext.industry || "Core capability",
          }))
        : [
            { name: "Strategy", level: "Strong", category: "Core capability" },
            { name: "Communication", level: "Strong", category: "Core capability" },
            { name: "Execution", level: "Strong", category: "Core capability" },
          ],
    },
  };
}

function createChartSection() {
  return {
    type: "dashboardChart",
    data: {
      chartTitle: "Portfolio metrics snapshot",
      xAxisLabel: "Quarter",
      yAxisLabel: "Impact",
      data: {
        sales: [18, 26, 31, 40],
        revenue: [22, 30, 38, 45],
        xLabels: ["Q1", "Q2", "Q3", "Q4"],
        hiddenPoints: [],
      },
      categories: ["Insights", "Delivery", "Communication"],
      categoryData: [38, 34, 28],
      isActive: true,
    },
  };
}

function createTableSection() {
  return {
    type: "dashboardTable",
    data: {
      tableTitle: "Capability summary",
      tableData: [
        { name: "Analysis", value: 92, percentage: 40, icon: "AN", link: "", buttonText: "" },
        { name: "Modeling", value: 88, percentage: 35, icon: "ML", link: "", buttonText: "" },
        { name: "Storytelling", value: 84, percentage: 25, icon: "ST", link: "", buttonText: "" },
      ],
    },
  };
}

function buildFallbackDraft(prompt, userContext, payload = {}) {
  const lower = cleanString(prompt).toLowerCase();
  const looksLikeService =
    /(agency|studio|service|consult|freelance|repair|home|clinic|brand|business)/.test(lower);
  const looksLikeData =
    /(data|dashboard|analytics|machine learning|ml|ai|insight|experiment|model)/.test(lower);
  const looksLikeNarrative =
    /(product|case study|strategy|consultant|designer|growth|ux)/.test(lower);
  const wantsFaq =
    /(faq|frequently asked|common questions|objections|pricing questions)/.test(lower);
  const wantsClientProof =
    /(trusted by|logos|logo cloud|logo strip|brands worked with|clients worked with|partners)/.test(lower);
  const wantsCredentials =
    /(certif|credential|licensed|license|accredit|board[- ]certified|pmp|scrum|aws certification)/.test(lower);
  const wantsLanguages =
    /(language|languages|bilingual|multilingual|english|spanish|french|german|arabic|portuguese)/.test(lower);
  const wantsTeam =
    /(agency|studio|collective|team|crew)/.test(lower);
  const wantsVideo =
    /(video|reel|showreel|demo|walkthrough|youtube|vimeo|loom|talk)/.test(lower);

  const sections = [];
  if (looksLikeService) sections.push(createHeroSection(prompt, userContext));
  sections.push(createSummarySection(prompt, userContext));

  if (looksLikeService) sections.push(createServicesSection(prompt));
  if (wantsFaq) sections.push(createFaqSection());
  if (wantsClientProof) sections.push(createClientLogosSection());
  if (wantsTeam) sections.push(createTeamSection());
  if (looksLikeData) {
    sections.push(createChartSection());
    sections.push(createTableSection());
  }
  if (looksLikeNarrative) sections.push(createCaseStudySection());
  if (wantsCredentials) sections.push(createCertificationsSection());
  if (wantsLanguages) sections.push(createLanguagesSection());
  if (wantsVideo) sections.push(createVideoEmbedSection());

  sections.push(createProjectsSection(prompt));
  if (!looksLikeService && userContext.skills.length) sections.push(createSkillsSection(userContext));
  sections.push(createContactSection(userContext));

  return {
    title: cleanString(payload.title) || buildTitleFromPrompt(prompt, userContext.name),
    themeId: inferThemeId(prompt),
    layoutMode: "stacked",
    socialLinks: userContext.socialLinks,
    sections: sections.slice(0, 10),
  };
}

function normalizeGeneratedDraft(draft, prompt, userContext, payload = {}) {
  if (!isPlainObject(draft)) {
    return buildFallbackDraft(prompt, userContext, payload);
  }

  const sections = Array.isArray(draft.sections)
    ? draft.sections
        .filter((section) => isPlainObject(section) && cleanString(section.type))
        .map((section) => ({
          type: cleanString(section.type),
          visible: section.visible === undefined ? true : Boolean(section.visible),
          data: isPlainObject(section.data) ? section.data : {},
        }))
    : [];

  return {
    title: cleanString(draft.title) || cleanString(payload.title) || buildTitleFromPrompt(prompt, userContext.name),
    themeId: normalizeThemeId(draft.themeId || inferThemeId(prompt)),
    layoutMode: draft.layoutMode === "singleSection" ? "singleSection" : "stacked",
    themeTokens: isPlainObject(draft.themeTokens) ? draft.themeTokens : {},
    socialLinks: isPlainObject(draft.socialLinks)
      ? draft.socialLinks
      : userContext.socialLinks,
    unsupportedNeed: cleanString(draft.unsupportedNeed),
    sections: sections.length ? sections : buildFallbackDraft(prompt, userContext, payload).sections,
  };
}

function normalizeEditableSections(sections, fallbackSections = []) {
  const nextSections = Array.isArray(sections)
    ? sections
        .filter((section) => isPlainObject(section) && cleanString(section.type))
        .map((section) => ({
          type: cleanString(section.type),
          visible: section.visible === undefined ? true : Boolean(section.visible),
          data: isPlainObject(section.data) ? section.data : {},
        }))
    : [];

  return nextSections.length ? nextSections : fallbackSections;
}

function normalizeEditablePortfolio(currentPortfolio, currentDraft) {
  const base = isPlainObject(currentDraft) ? currentDraft : currentPortfolio;
  const fallbackSections = Array.isArray(currentPortfolio?.sections)
    ? currentPortfolio.sections.map((section) => ({
        type: cleanString(section.type),
        visible: section.visible !== false,
        data: isPlainObject(section.data) ? section.data : {},
      }))
    : [];

  return {
    title: cleanString(base?.title) || cleanString(currentPortfolio?.title) || "Portfolio",
    themeId: normalizeThemeId(base?.themeId || currentPortfolio?.themeId || DEFAULT_THEME),
    layoutMode:
      cleanString(base?.layoutMode) === "singleSection" ||
      cleanString(currentPortfolio?.layoutMode) === "singleSection"
        ? "singleSection"
        : "stacked",
    themeTokens: isPlainObject(base?.themeTokens)
      ? base.themeTokens
      : isPlainObject(currentPortfolio?.themeTokens)
        ? currentPortfolio.themeTokens
        : {},
    socialLinks: isPlainObject(base?.socialLinks)
      ? base.socialLinks
      : isPlainObject(currentPortfolio?.socialLinks)
        ? currentPortfolio.socialLinks
        : {},
    sections: normalizeEditableSections(base?.sections, fallbackSections),
  };
}

function createGallerySection() {
  return {
    type: "gallery",
    data: {
      items: [
        {
          title: "Featured visual",
          image: "",
          description: "Add a visual example that supports the story you want to tell.",
        },
      ],
    },
  };
}

function buildEditFallbackDraft(instruction, currentPortfolio) {
  const lower = cleanString(instruction).toLowerCase();
  const next = JSON.parse(JSON.stringify(currentPortfolio));
  const insertBeforeContact = (section) => {
    if (next.sections.some((item) => item.type === section.type)) return;
    const contactIndex = next.sections.findIndex((item) => item.type === "contact");
    const insertIndex = contactIndex >= 0 ? contactIndex : next.sections.length;
    next.sections.splice(insertIndex, 0, section);
  };

  if (/(single[ -]?section|one[ -]?page|one section|single page)/.test(lower)) {
    next.layoutMode = "singleSection";
  }

  if (/(stacked|scrolling|full page)/.test(lower)) {
    next.layoutMode = "stacked";
  }

  if (/(minimal|clean|editorial|lighter)/.test(lower)) {
    next.themeId = "paper";
  }

  if (/(bold|bolder|vibrant|warmer|creative)/.test(lower)) {
    next.themeId = "sunrise";
  }

  if (/(professional|sleek|polished)/.test(lower)) {
    next.themeId = "aurora";
  }

  if (/(forest|nature|organic|eco|sustainable)/.test(lower)) {
    next.themeId = "forest";
  }
  if (/(ocean|marine|coastal|nautical|aqua)/.test(lower)) {
    next.themeId = "ocean";
  }
  if (/(midnight|cosmic|galaxy|vaporwave)/.test(lower)) {
    next.themeId = "midnight";
  }
  if (/(terracotta|rustic|earthy|clay)/.test(lower)) {
    next.themeId = "clay";
  }
  if (/(corporate|enterprise|formal|slate)/.test(lower)) {
    next.themeId = "slate";
  }
  if (/(blush|feminine|spa|wedding|rose)\b/.test(lower)) {
    next.themeId = "rose";
  }

  if (/(more visual|show visuals|image-heavy|add gallery)/.test(lower)) {
    const hasGallery = next.sections.some((section) => section.type === "gallery");
    if (!hasGallery) {
      const insertIndex = Math.max(0, next.sections.length - 1);
      next.sections.splice(insertIndex, 0, createGallerySection());
    }
  }

  if (/(more minimal|simpler|streamline|trim)/.test(lower)) {
    next.sections = next.sections.filter(
      (section) => !["blog", "gallery", "dashboardTable"].includes(section.type)
    );
  }

  if (/(more professional|executive)/.test(lower)) {
    next.sections = next.sections.filter((section) => section.type !== "gallery");
    const summary = next.sections.find((section) => section.type === "summary");
    if (summary && isPlainObject(summary.data)) {
      summary.data.summary =
        cleanString(summary.data.summary) ||
        "A polished portfolio focused on credibility, clarity, and measurable outcomes.";
    }
  }

  if (/(faq|common questions|objections)/.test(lower)) {
    insertBeforeContact(createFaqSection());
  }

  if (/(trusted by|logos|logo strip|partners|brands worked with)/.test(lower)) {
    insertBeforeContact(createClientLogosSection());
  }

  if (/(certif|credential|licensed|license|accredit)/.test(lower)) {
    insertBeforeContact(createCertificationsSection());
  }

  if (/(language|languages|bilingual|multilingual)/.test(lower)) {
    insertBeforeContact(createLanguagesSection());
  }

  if (/(team|agency|studio|collective|crew)/.test(lower)) {
    insertBeforeContact(createTeamSection());
  }

  if (/(video|reel|showreel|demo|walkthrough|youtube|vimeo|loom|talk)/.test(lower)) {
    insertBeforeContact(createVideoEmbedSection());
  }

  return next;
}

function normalizeEditDraft(draft, currentPortfolio, instruction) {
  if (!isPlainObject(draft)) {
    return buildEditFallbackDraft(instruction, currentPortfolio);
  }

  return {
    title: cleanString(draft.title) || currentPortfolio.title,
    themeId: normalizeThemeId(draft.themeId || currentPortfolio.themeId),
    layoutMode: cleanString(draft.layoutMode) === "singleSection" ? "singleSection" : "stacked",
    themeTokens: isPlainObject(draft.themeTokens) ? draft.themeTokens : currentPortfolio.themeTokens,
    socialLinks: isPlainObject(draft.socialLinks) ? draft.socialLinks : currentPortfolio.socialLinks,
    sections: normalizeEditableSections(draft.sections, currentPortfolio.sections),
  };
}

function buildEditChangeSummary(currentPortfolio, nextPortfolio) {
  const beforeTypes = currentPortfolio.sections.map((section) => section.type);
  const afterTypes = nextPortfolio.sections.map((section) => section.type);
  const addedSections = afterTypes.filter((type) => !beforeTypes.includes(type));
  const removedSections = beforeTypes.filter((type) => !afterTypes.includes(type));
  const changedSections = nextPortfolio.sections
    .filter((section, index) => {
      const before = currentPortfolio.sections[index];
      if (!before || before.type !== section.type) return false;
      return JSON.stringify(before.data || {}) !== JSON.stringify(section.data || {});
    })
    .map((section) => section.type);

  const summary = [];

  if (currentPortfolio.themeId !== nextPortfolio.themeId) {
    summary.push(`Theme changes from ${currentPortfolio.themeId} to ${nextPortfolio.themeId}.`);
  }

  if (currentPortfolio.layoutMode !== nextPortfolio.layoutMode) {
    summary.push(
      `Layout changes from ${currentPortfolio.layoutMode} to ${nextPortfolio.layoutMode}.`
    );
  }

  if (currentPortfolio.title !== nextPortfolio.title) {
    summary.push("Portfolio title is updated.");
  }

  if (addedSections.length) {
    summary.push(`Adds ${addedSections.join(", ")} section${addedSections.length === 1 ? "" : "s"}.`);
  }

  if (removedSections.length) {
    summary.push(
      `Removes ${removedSections.join(", ")} section${removedSections.length === 1 ? "" : "s"}.`
    );
  }

  if (changedSections.length) {
    summary.push(
      `Rewrites content in ${changedSections.join(", ")} section${changedSections.length === 1 ? "" : "s"}.`
    );
  }

  if (!summary.length) {
    summary.push("Keeps the current structure and makes only light refinements.");
  }

  return {
    addedSections,
    removedSections,
    changedSections,
    summary,
  };
}

async function generateEditDraftWithOpenAI(instruction, userContext, currentPortfolio) {
  const client = getOpenAIClient();
  if (!client) {
    return {
      source: "fallback",
      draft: buildEditFallbackDraft(instruction, currentPortfolio),
    };
  }

  const blockCatalog = buildBlockCatalogPrompt();
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are editing an existing block-based portfolio. Output valid JSON only. Preserve the same overall identity unless the instruction explicitly asks for a stronger change. Use only allowed themes and block types. Return a full proposed portfolio state rather than prose.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Edit this existing agent portfolio according to the instruction.",
            instruction,
            allowedThemes: ALLOWED_THEMES,
            userContext,
            blockCatalog,
            currentPortfolio,
            outputSchema: {
              title: "string",
              themeId: `one of: ${ALLOWED_THEMES.join(", ")}`,
              layoutMode: "stacked | singleSection",
              themeTokens: {
                accent: "",
                accentStrong: "",
                page: "",
                text: "",
              },
              socialLinks: {
                github: "",
                linkedin: "",
                twitter: "",
                instagram: "",
                website: "",
              },
              sections: [
                {
                  type: "one allowed block type",
                  visible: true,
                  data: "object that matches the selected block shape",
                },
              ],
            },
          },
          null,
          2
        ),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  return {
    source: "openai",
    draft: normalizeEditDraft(JSON.parse(content), currentPortfolio, instruction),
  };
}

async function proposeAgentPortfolioEdit(user = {}, savedPortfolio = {}, payload = {}) {
  const instruction = cleanString(payload.instruction);
  if (!instruction) {
    throw new PortfolioValidationError("instruction is required", {
      code: "INSTRUCTION_REQUIRED",
    });
  }

  const heuristicUnsupportedNeed = findUnsupportedNeed(instruction);
  if (heuristicUnsupportedNeed) {
    throw buildUnsupportedCapabilityError(instruction, heuristicUnsupportedNeed);
  }

  const currentPortfolio = normalizeEditablePortfolio(savedPortfolio, payload.currentDraft);
  const userContext = buildUserContext(user);

  let generated;
  try {
    generated = await generateEditDraftWithOpenAI(instruction, userContext, currentPortfolio);
  } catch (err) {
    console.error("agentPortfolioGenerator.generateEditDraftWithOpenAI error:", err);
    generated = {
      source: "fallback",
      draft: buildEditFallbackDraft(instruction, currentPortfolio),
    };
  }

  const proposal = normalizeEditDraft(generated.draft, currentPortfolio, instruction);

  return {
    source: generated.source,
    proposal,
    changes: buildEditChangeSummary(currentPortfolio, proposal),
  };
}

async function generateDraftWithOpenAI(prompt, userContext, payload = {}) {
  const client = getOpenAIClient();
  if (!client) {
    return {
      source: "fallback",
      draft: buildFallbackDraft(prompt, userContext, payload),
    };
  }

  const blockCatalog = buildBlockCatalogPrompt();
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You generate portfolio compositions using ONLY the provided block catalog. Output valid JSON only. Choose 3 to 7 sections. Keep all text concise and immediately renderable. Do not invent unsupported blocks, app features, or data structures. If the request mainly requires unsupported interactive product features, set unsupportedNeed to a short phrase and return an empty sections array.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Create a unified agent portfolio draft from this user prompt.",
            prompt,
            preferredTemplate: "agent",
            allowedThemes: ALLOWED_THEMES,
            userContext,
            blockCatalog,
            outputSchema: {
              title: "string",
              themeId: `one of: ${ALLOWED_THEMES.join(", ")}`,
              layoutMode: "stacked | singleSection",
              unsupportedNeed: "string or empty",
              socialLinks: {
                github: "",
                linkedin: "",
                twitter: "",
                instagram: "",
                website: "",
              },
              sections: [
                {
                  type: "one allowed block type",
                  visible: true,
                  data: "object that matches the selected block shape",
                },
              ],
            },
          },
          null,
          2
        ),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  return {
    source: "openai",
    draft: normalizeGeneratedDraft(JSON.parse(content), prompt, userContext, payload),
  };
}

async function generateAgentPortfolioFromPrompt(ownerId, user = {}, payload = {}) {
  const prompt = cleanString(payload.prompt);
  if (!prompt) {
    throw new PortfolioValidationError("prompt is required", {
      code: "PROMPT_REQUIRED",
    });
  }

  const heuristicUnsupportedNeed = findUnsupportedNeed(prompt);
  if (heuristicUnsupportedNeed) {
    throw buildUnsupportedCapabilityError(prompt, heuristicUnsupportedNeed);
  }

  const userContext = buildUserContext(user);
  let generated;

  try {
    generated = await generateDraftWithOpenAI(prompt, userContext, payload);
  } catch (err) {
    console.error("agentPortfolioGenerator.generateDraftWithOpenAI error:", err);
    generated = {
      source: "fallback",
      draft: buildFallbackDraft(prompt, userContext, payload),
    };
  }

  const draft = normalizeGeneratedDraft(generated.draft, prompt, userContext, payload);
  if (draft.unsupportedNeed) {
    throw buildUnsupportedCapabilityError(prompt, draft.unsupportedNeed);
  }

  const portfolio = await createAgentPortfolio(ownerId, {
    baseTemplate: cleanString(payload.baseTemplate) || "agent",
    title: draft.title,
    visibility: cleanString(payload.visibility) || "private",
    hideBranding: Boolean(payload.hideBranding),
    socialLinks: draft.socialLinks,
    themeId: draft.themeId,
    themeTokens: draft.themeTokens,
    layoutMode: draft.layoutMode,
    requestedCapability: prompt,
    generationModel: generated.source === "openai" ? OPENAI_MODEL : "fallback-composer",
    generationVersion: GENERATION_VERSION,
    generationPromptHash: hashPrompt(prompt),
    sections: draft.sections,
  });

  return {
    portfolio,
    source: generated.source,
  };
}

module.exports = {
  ALLOWED_THEMES,
  GENERATION_VERSION,
  OPENAI_MODEL,
  generateAgentPortfolioFromPrompt,
  proposeAgentPortfolioEdit,
};
