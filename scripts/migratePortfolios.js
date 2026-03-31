/**
 * Migration script: transforms legacy per-type portfolio documents
 * (healthcaresettings, portfolios, handymantemplates + handymanportfolios)
 * into the unified sections/blocks Portfolio model (portfolios_v2).
 *
 * Safe to re-run: skips documents whose _id already exists in portfolios_v2.
 *
 * Usage:
 *   MONGODB_URI=mongodb://... node scripts/migratePortfolios.js --dry-run
 *   MONGODB_URI=mongodb://... node scripts/migratePortfolios.js --templates=healthcare,handyman --limit=25
 *   MONGODB_URI=mongodb://... node scripts/migratePortfolios.js --report-json=./migration-report.json
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");

const HealthcarePortfolio = require("../models/healthcare/userData");
const ProjectManagerPortfolio = require("../models/projectManager/portfolioModel");
const HandymanMainPortfolio = require("../models/handyMan/HandymanTemplate");
const HandymanGalleryItem = require("../models/handyMan/handymanPortfolioModel");
const Portfolio = require("../models/portfolio/Portfolio");
const User = require("../models/User");

const SUPPORTED_TEMPLATES = ["healthcare", "projectManager", "handyman"];

function parseArgs(argv) {
  const options = {
    dryRun: false,
    templates: [...SUPPORTED_TEMPLATES],
    limit: null,
    reportJsonPath: "",
    dnsServers: [],
    skipUnresolvedOwners: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("--templates=")) {
      const raw = arg.split("=")[1] || "";
      const selected = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!selected.length) {
        throw new Error("--templates requires a comma-separated list");
      }
      const invalid = selected.filter((item) => !SUPPORTED_TEMPLATES.includes(item));
      if (invalid.length) {
        throw new Error(
          `Unsupported template(s): ${invalid.join(", ")}. Supported: ${SUPPORTED_TEMPLATES.join(", ")}`
        );
      }
      options.templates = [...new Set(selected)];
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = arg.split("=")[1];
      const value = Number(raw);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--limit must be a positive integer");
      }
      options.limit = value;
      continue;
    }
    if (arg.startsWith("--report-json=")) {
      options.reportJsonPath = (arg.split("=")[1] || "").trim();
      if (!options.reportJsonPath) {
        throw new Error("--report-json requires a file path");
      }
      continue;
    }
    if (arg.startsWith("--dns-servers=")) {
      const selected = (arg.split("=")[1] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!selected.length) {
        throw new Error("--dns-servers requires a comma-separated list");
      }
      options.dnsServers = selected;
      continue;
    }
    if (arg === "--skip-unresolved-owners") {
      options.skipUnresolvedOwners = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/migratePortfolios.js [--dry-run] [--templates=healthcare,projectManager,handyman] [--limit=50] [--report-json=path] [--dns-servers=8.8.8.8,1.1.1.1] [--skip-unresolved-owners]

Options:
  --dry-run            Run full transform/validation without writing to portfolios_v2 or User docs
  --templates=...      Comma-separated templates to migrate (healthcare, projectManager, handyman)
  --limit=...          Max number of legacy docs processed per selected template
  --report-json=...    Write machine-readable report JSON to the provided path
  --dns-servers=...    Optional DNS servers used for SRV lookup in this Node process
  --skip-unresolved-owners
                       Skip projectManager records with unresolved owners (report-only)
  --help, -h           Show this help message
  `);
}

function resolveDnsServers(options) {
  if (Array.isArray(options.dnsServers) && options.dnsServers.length) {
    return options.dnsServers;
  }
  const fromEnv = (process.env.MIGRATION_DNS_SERVERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv;
}

function toObjectIdOrNull(value) {
  if (!value) return null;
  const raw = value.toString();
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function validateTransformedPortfolio(payload) {
  const doc = new Portfolio(payload);
  const validationError = doc.validateSync();
  if (!validationError) return;

  const details = Object.values(validationError.errors || {})
    .map((err) => err.message)
    .join("; ");
  throw new Error(details || "Portfolio validation failed");
}

function ensureOwner(doc, template) {
  const owner = toObjectIdOrNull(doc?.userId);
  if (!owner) {
    throw new Error(`${template} ${doc?._id}: missing or invalid owner userId`);
  }
  return owner;
}

function writeJsonReport(filePath, report) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const directory = path.dirname(absolutePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

function createTemplateStats() {
  return {
    legacyCount: 0,
    existingV2Count: 0,
    expectedToInsert: 0,
    processed: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {
      alreadyExists: 0,
      unresolvedOwner: 0,
    },
    failures: [],
  };
}

function recordFailure(stats, template, docId, message) {
  stats.failed += 1;
  stats.failures.push({
    template,
    legacyId: docId ? docId.toString() : "",
    error: message,
  });
}

const userEmailOwnerCache = new Map();

async function resolveProjectManagerOwner(doc) {
  const directOwner = toObjectIdOrNull(doc?.userId);
  if (directOwner) {
    return { owner: directOwner, source: "userId" };
  }

  const email = (doc?.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error(`projectManager ${doc?._id}: missing or invalid owner userId`);
    error.code = "UNRESOLVED_OWNER";
    throw error;
  }

  if (userEmailOwnerCache.has(email)) {
    const cachedId = userEmailOwnerCache.get(email);
    if (!cachedId) {
      const error = new Error(
        `projectManager ${doc?._id}: missing or invalid owner userId and no user found for email ${email}`
      );
      error.code = "UNRESOLVED_OWNER";
      throw error;
    }
    return { owner: cachedId, source: "email" };
  }

  const user = await User.findOne({ email }).select("_id").lean();
  if (!user?._id) {
    userEmailOwnerCache.set(email, null);
    const error = new Error(
      `projectManager ${doc?._id}: missing or invalid owner userId and no user found for email ${email}`
    );
    error.code = "UNRESOLVED_OWNER";
    throw error;
  }

  const resolvedId = new mongoose.Types.ObjectId(user._id);
  userEmailOwnerCache.set(email, resolvedId);
  return { owner: resolvedId, source: "email" };
}

// ─── Transformers ────────────────────────────────────────────────────────────

function transformHealthcare(doc) {
  const owner = ensureOwner(doc, "healthcare");
  const sections = [];
  let order = 0;

  sections.push({
    type: "hero",
    order: order++,
    data: {
      practiceName: doc.practice?.name || "",
      tagline: doc.practice?.tagline || "",
      description: doc.practice?.description || "",
      logoImage: doc.practice?.logoImage || "",
      icon: doc.practice?.icon || "",
      primaryButtonText: doc.ui?.hero?.primaryButtonText || "Get Started",
      secondaryButtonText: doc.ui?.hero?.secondaryButtonText || "Learn More",
      backgroundImage: doc.ui?.hero?.backgroundImage || "",
    },
  });

  sections.push({
    type: "stats",
    order: order++,
    data: {
      showStatsSection: doc.statsVisibility?.showStatsSection ?? true,
      yearsExperience: doc.stats?.yearsExperience || "0",
      patientsServed: doc.stats?.patientsServed || "0",
      successRate: doc.stats?.successRate || "0",
      doctorsCount: doc.stats?.doctorsCount || "0",
      visibility: {
        yearsExperience: doc.statsVisibility?.yearsExperience ?? true,
        patientsServed: doc.statsVisibility?.patientsServed ?? true,
        successRate: doc.statsVisibility?.successRate ?? true,
        doctorsCount: doc.statsVisibility?.doctorsCount ?? true,
      },
    },
  });

  sections.push({
    type: "services",
    order: order++,
    data: {
      items: (doc.services || []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        icon: s.icon,
        price: s.price,
        duration: s.duration,
        image: s.image,
        features: s.features || [],
      })),
      viewAllText: doc.ui?.services?.viewAllText || "View All Services",
      bookButtonText: doc.ui?.services?.bookButtonText || "Book Now",
    },
  });

  sections.push({
    type: "gallery",
    order: order++,
    data: {
      facilityImages: (doc.gallery?.facilityImages || []).map((img) => ({
        url: img.url,
        caption: img.caption,
        description: img.description,
      })),
      beforeAfterCases: (doc.gallery?.beforeAfterCases || []).map((c) => ({
        title: c.title,
        treatment: c.treatment,
        duration: c.duration,
        description: c.description,
        beforeImage: c.beforeImage,
        afterImage: c.afterImage,
      })),
    },
  });

  sections.push({
    type: "blog",
    order: order++,
    data: {
      posts: (doc.blogPosts || []).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        image: p.image,
        publishDate: p.publishDate,
        author: p.author,
        category: p.category,
        tags: p.tags || [],
        readTime: p.readTime,
        featured: p.featured,
      })),
      readMoreText: doc.ui?.blog?.readMoreText || "Read More",
      viewAllText: doc.ui?.blog?.viewAllText || "View All Posts",
    },
  });

  sections.push({
    type: "contact",
    order: order++,
    data: {
      phone: doc.contact?.phone || "",
      whatsapp: doc.contact?.whatsapp || "",
      email: doc.contact?.email || "",
      address: {
        street: doc.contact?.address?.street || "",
        city: doc.contact?.address?.city || "",
        state: doc.contact?.address?.state || "",
        zip: doc.contact?.address?.zip || "",
      },
      buttonText: doc.ui?.contact?.buttonText || "Contact Us",
      submitText: doc.ui?.contact?.submitText || "Send Message",
    },
  });

  sections.push({
    type: "hours",
    order: order++,
    data: {
      weekdays: doc.hours?.weekdays || "Mon-Fri: 9:00 AM - 5:00 PM",
      saturday: doc.hours?.saturday || "Sat: Closed",
      sunday: doc.hours?.sunday || "Sun: Closed",
    },
  });

  sections.push({
    type: "seo",
    order: order++,
    data: {
      siteTitle: doc.seo?.siteTitle || "",
      metaDescription: doc.seo?.metaDescription || "",
      keywords: doc.seo?.keywords || "",
    },
  });

  return {
    _id: doc._id,
    owner,
    slug: doc.subdomain || undefined,
    title: doc.portfolioName || "Healthcare Portfolio",
    template: "healthcare",
    visibility: doc.isPublic ? "public" : "private",
    hideBranding: doc.hideBranding || false,
    socialLinks: doc.socialLinks || {},
    sections,
  };
}

async function transformProjectManager(doc) {
  const { owner, source } = await resolveProjectManagerOwner(doc);
  const sections = [];
  let order = 0;

  sections.push({
    type: "summary",
    order: order++,
    data: {
      name: doc.name || "",
      title: doc.title || "",
      bio: doc.bio || "",
      summary: doc.summary || "",
      email: doc.email || "",
      phone: doc.phone || "",
      location: doc.location || "",
      profileImage: doc.profileImage || "",
      profileImageKey: doc.profileImageKey || "",
      resumeUrl: doc.resumeUrl || "",
      resumeKey: doc.resumeKey || "",
    },
  });

  sections.push({
    type: "skills",
    order: order++,
    data: {
      items: doc.skills || [],
    },
  });

  sections.push({
    type: "experience",
    order: order++,
    data: {
      items: (doc.experiences || []).map((e) => ({
        company: e.company,
        title: e.title,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
    },
  });

  sections.push({
    type: "education",
    order: order++,
    data: {
      items: (doc.education || []).map((e) => ({
        school: e.school,
        gpa: e.gpa,
        degrees: e.degrees,
        fieldOfStudy: e.fieldOfStudy,
        awards: e.awards,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
    },
  });

  sections.push({
    type: "projects",
    order: order++,
    data: {
      items: (doc.projects || []).map((p) => ({
        name: p.name,
        description: p.description,
        link: p.link,
      })),
    },
  });

  sections.push({
    type: "contact",
    order: order++,
    data: {
      email: doc.email || "",
      phone: doc.phone || "",
      location: doc.location || "",
    },
  });

  return {
    _id: doc._id,
    owner,
    slug: undefined,
    title: doc.portfolioName || "Project Manager Portfolio",
    template: "projectManager",
    visibility: doc.isPublic ? "public" : "private",
    hideBranding: doc.hideBranding || false,
    socialLinks: doc.socialLinks || {},
    migrationMeta: {
      ownerResolvedFrom: source,
    },
    sections,
  };
}

function transformHandyman(doc, galleryItems) {
  const owner = ensureOwner(doc, "handyman");
  const sections = [];
  let order = 0;

  const fallbackPhone = doc.hero?.phoneNumber || "";
  sections.push({
    type: "hero",
    order: order++,
    data: {
      title: doc.hero?.title || "",
      subtitle: doc.hero?.subtitle || "",
      phoneNumber: doc.hero?.phoneNumber || "",
      imageUrl: doc.hero?.imageUrl || "",
      badge1Text: doc.hero?.badge1Text || "",
      badge2Text: doc.hero?.badge2Text || "",
      badge3Text: doc.hero?.badge3Text || "",
      ctaText: doc.hero?.ctaText || "",
    },
  });

  sections.push({
    type: "services",
    order: order++,
    data: {
      sectionTitle: doc.servicesSectionTitle || "",
      sectionIntro: doc.servicesSectionIntro || "",
      items: (doc.services || []).map((s) => ({
        icon: s.icon,
        title: s.title || s.name,
        description: s.description,
        bullets: s.bullets || [],
        price: s.price,
      })),
    },
  });

  sections.push({
    type: "gallery",
    order: order++,
    data: {
      sectionTitle: doc.portfolioTitle || "Quality Craftsmanship You Can See",
      sectionSubtitle: doc.portfolioSubtitle || "",
      allLabel: doc.portfolioAllLabel || "All",
      items: (galleryItems || []).map((g) => ({
        _id: g._id,
        title: g.title,
        category: g.category,
        subtitle: g.subtitle || "",
        beforeImageUrl: g.beforeImageUrl,
        afterImageUrl: g.afterImageUrl,
        beforeImageKey: g.beforeImageKey,
        afterImageKey: g.afterImageKey,
      })),
    },
  });

  sections.push({
    type: "process",
    order: order++,
    data: {
      sectionTitle: doc.processSectionTitle || "Our Simple Process",
      steps: (doc.processSteps || []).map((s) => ({
        number: s.number,
        title: s.title,
        description: s.description,
      })),
    },
  });

  sections.push({
    type: "testimonials",
    order: order++,
    data: {
      sectionTitle: doc.testimonialsSectionTitle || "What Our Clients Say",
      items: (doc.testimonials || []).map((t) => ({
        name: t.name,
        quote: t.quote,
        location: t.location,
        service: t.service,
      })),
    },
  });

  sections.push({
    type: "contact",
    order: order++,
    data: {
      title: doc.contact?.title || "",
      subtitle: doc.contact?.subtitle || "",
      formTitle: doc.contact?.formTitle || "",
      phone: doc.contact?.phone || fallbackPhone,
      email: doc.contact?.email || "",
      hours: doc.contact?.hours || "",
      note: doc.contact?.note || "",
    },
  });

  return {
    _id: doc._id,
    owner,
    slug: undefined,
    title: doc.portfolioName || "Handyman Portfolio",
    template: "handyman",
    visibility: doc.isPublic ? "public" : "private",
    hideBranding: doc.hideBranding || false,
    socialLinks: doc.socialLinks || {},
    sections,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function migrate(options) {
  const dnsServers = resolveDnsServers(options);
  if (dnsServers.length) {
    dns.setServers(dnsServers);
    console.log(`Using custom DNS servers for migration: ${dnsServers.join(", ")}`);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI in env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const report = {
    startedAt: new Date().toISOString(),
    options: {
      dryRun: options.dryRun,
      templates: options.templates,
      limit: options.limit,
      dnsServers,
      skipUnresolvedOwners: options.skipUnresolvedOwners,
    },
    preflight: {
      templates: {},
      selectedTemplates: options.templates,
      selectedExistingV2Total: 0,
      selectedLegacyTotal: 0,
      selectedExpectedInserts: 0,
    },
    migration: {
      ownerResolution: {
        fromUserId: 0,
        fromEmail: 0,
        unresolved: 0,
        skippedByPolicy: 0,
      },
      templates: {},
      totals: {
        processed: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
      },
      userSync: {
        attempted: false,
        usersUpdated: 0,
        failed: 0,
        errors: [],
      },
    },
  };

  for (const template of options.templates) {
    report.preflight.templates[template] = createTemplateStats();
    report.migration.templates[template] = createTemplateStats();
  }

  const legacyDocsByTemplate = {
    healthcare: [],
    projectManager: [],
    handyman: [],
  };

  const findOptions = options.limit ? { limit: options.limit } : {};

  if (options.templates.includes("healthcare")) {
    legacyDocsByTemplate.healthcare = await HealthcarePortfolio.find({}, null, findOptions).lean();
  }
  if (options.templates.includes("projectManager")) {
    legacyDocsByTemplate.projectManager = await ProjectManagerPortfolio.find({}, null, findOptions).lean();
  }
  if (options.templates.includes("handyman")) {
    legacyDocsByTemplate.handyman = await HandymanMainPortfolio.find({}, null, findOptions).lean();
  }

  const selectedLegacyIds = options.templates.flatMap((template) =>
    (legacyDocsByTemplate[template] || []).map((doc) => doc._id)
  );
  const existingById = await Portfolio.find(
    { _id: { $in: selectedLegacyIds } },
    { _id: 1, template: 1 }
  ).lean();
  const existingIds = new Set(existingById.map((item) => item._id.toString()));

  const existingSelectedCounts = await Portfolio.aggregate([
    { $match: { template: { $in: options.templates } } },
    { $group: { _id: "$template", count: { $sum: 1 } } },
  ]);
  const existingSelectedMap = Object.fromEntries(
    existingSelectedCounts.map((row) => [row._id, row.count])
  );

  for (const template of options.templates) {
    const docs = legacyDocsByTemplate[template] || [];
    const preflight = report.preflight.templates[template];

    preflight.legacyCount = docs.length;
    preflight.existingV2Count = existingSelectedMap[template] || 0;
    preflight.expectedToInsert = docs.reduce((total, doc) => {
      return total + (existingIds.has(doc._id.toString()) ? 0 : 1);
    }, 0);

    report.preflight.selectedExistingV2Total += preflight.existingV2Count;
    report.preflight.selectedLegacyTotal += preflight.legacyCount;
    report.preflight.selectedExpectedInserts += preflight.expectedToInsert;
  }

  console.log("\nPreflight summary:");
  console.log(JSON.stringify(report.preflight, null, 2));

  async function processTemplate(template, docs, transformFn) {
    const stats = report.migration.templates[template];
    console.log(`\nProcessing ${template} (${docs.length} docs)...`);
    for (const doc of docs) {
      stats.processed += 1;
      report.migration.totals.processed += 1;

      if (existingIds.has(doc._id.toString())) {
        stats.skipped += 1;
        stats.skipReasons.alreadyExists += 1;
        report.migration.totals.skipped += 1;
        continue;
      }

      try {
        const transformed = await transformFn(doc);
        if (template === "projectManager") {
          const source = transformed?.migrationMeta?.ownerResolvedFrom;
          if (source === "email") {
            report.migration.ownerResolution.fromEmail += 1;
          } else if (source === "userId") {
            report.migration.ownerResolution.fromUserId += 1;
          }
          if (transformed?.migrationMeta) {
            delete transformed.migrationMeta;
          }
        }
        validateTransformedPortfolio(transformed);

        if (!options.dryRun) {
          await Portfolio.create(transformed);
        }

        stats.inserted += 1;
        report.migration.totals.inserted += 1;
      } catch (err) {
        const message = err?.message || "Unknown migration error";
        if (
          template === "projectManager" &&
          err?.code === "UNRESOLVED_OWNER" &&
          options.skipUnresolvedOwners
        ) {
          stats.skipped += 1;
          stats.skipReasons.unresolvedOwner += 1;
          report.migration.totals.skipped += 1;
          report.migration.ownerResolution.unresolved += 1;
          report.migration.ownerResolution.skippedByPolicy += 1;
          continue;
        }

        if (template === "projectManager" && err?.code === "UNRESOLVED_OWNER") {
          report.migration.ownerResolution.unresolved += 1;
        }
        recordFailure(stats, template, doc._id, message);
        report.migration.totals.failed += 1;
        console.error(`${template} ${doc._id}: ${message}`);
      }
    }
  }

  if (options.templates.includes("healthcare")) {
    await processTemplate(
      "healthcare",
      legacyDocsByTemplate.healthcare,
      async (doc) => transformHealthcare(doc)
    );
  }

  if (options.templates.includes("projectManager")) {
    await processTemplate(
      "projectManager",
      legacyDocsByTemplate.projectManager,
      async (doc) => transformProjectManager(doc)
    );
  }

  if (options.templates.includes("handyman")) {
    await processTemplate(
      "handyman",
      legacyDocsByTemplate.handyman,
      async (doc) => {
        const galleryItems = await HandymanGalleryItem.find({
          templateId: doc._id,
        }).lean();
        return transformHandyman(doc, galleryItems);
      }
    );
  }

  if (!options.dryRun) {
    report.migration.userSync.attempted = true;
    console.log("\nUpdating User.portfolios arrays...");

    // Rebuild user portfolio arrays from all v2 portfolios to avoid dropping
    // references outside the currently selected migration templates.
    const allSelected = await Portfolio.find(
      {},
      { _id: 1, owner: 1, template: 1, visibility: 1 }
    ).lean();
    const byOwner = new Map();
    for (const portfolio of allSelected) {
      const key = portfolio.owner?.toString();
      if (!key) continue;
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push({
        portfolioId: portfolio._id,
        portfolioType: portfolio.template,
        isPublic: portfolio.visibility === "public",
      });
    }

    for (const [ownerId, portfolios] of byOwner) {
      try {
        await User.findByIdAndUpdate(ownerId, { portfolios });
        report.migration.userSync.usersUpdated += 1;
      } catch (err) {
        report.migration.userSync.failed += 1;
        report.migration.userSync.errors.push({
          ownerId,
          error: err?.message || "User sync failed",
        });
        console.error(`User ${ownerId}: ${err?.message || "User sync failed"}`);
      }
    }
  }

  report.completedAt = new Date().toISOString();

  console.log("\nMigration summary:");
  console.log(JSON.stringify(report.migration, null, 2));

  if (options.reportJsonPath) {
    const outputPath = writeJsonReport(options.reportJsonPath, report);
    console.log(`\nReport written to ${outputPath}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    await migrate(options);
  } catch (err) {
    console.error("Migration failed:", err?.message || err);
    process.exit(1);
  }
}

main();
