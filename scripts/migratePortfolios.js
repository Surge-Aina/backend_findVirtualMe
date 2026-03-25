/**
 * Migration script: transforms legacy per-type portfolio documents
 * (healthcaresettings, portfolios, handymantemplates + handymanportfolios)
 * into the unified sections/blocks Portfolio model (portfolios_v2).
 *
 * Usage:
 *   MONGODB_URI=mongodb://... node scripts/migratePortfolios.js
 *
 * Safe to re-run: skips documents whose _id already exists in portfolios_v2.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const HealthcarePortfolio = require("../models/healthcare/userData");
const ProjectManagerPortfolio = require("../models/projectManager/portfolioModel");
const HandymanMainPortfolio = require("../models/handyMan/HandymanTemplate");
const HandymanGalleryItem = require("../models/handyMan/handymanPortfolioModel");
const Portfolio = require("../models/portfolio/Portfolio");
const User = require("../models/User");

// ─── Transformers ────────────────────────────────────────────────────────────

function transformHealthcare(doc) {
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
    owner: doc.userId,
    slug: doc.subdomain || undefined,
    title: doc.portfolioName || "Healthcare Portfolio",
    template: "healthcare",
    visibility: doc.isPublic ? "public" : "private",
    hideBranding: doc.hideBranding || false,
    socialLinks: doc.socialLinks || {},
    sections,
  };
}

function transformProjectManager(doc) {
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
    owner: doc.userId,
    slug: undefined,
    title: doc.portfolioName || "Project Manager Portfolio",
    template: "projectManager",
    visibility: doc.isPublic ? "public" : "private",
    hideBranding: doc.hideBranding || false,
    socialLinks: doc.socialLinks || {},
    sections,
  };
}

function transformHandyman(doc, galleryItems) {
  const sections = [];
  let order = 0;

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
      phone: doc.contact?.phone || "",
      email: doc.contact?.email || "",
      hours: doc.contact?.hours || "",
      note: doc.contact?.note || "",
    },
  });

  return {
    _id: doc._id,
    owner: doc.userId,
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

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI in env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const existingIds = new Set(
    (await Portfolio.find({}, { _id: 1 }).lean()).map((d) => d._id.toString())
  );

  let inserted = 0;
  let skipped = 0;

  // Healthcare
  const healthcareDocs = await HealthcarePortfolio.find({}).lean();
  console.log(`Found ${healthcareDocs.length} healthcare portfolios`);
  for (const doc of healthcareDocs) {
    if (existingIds.has(doc._id.toString())) {
      skipped++;
      continue;
    }
    try {
      const transformed = transformHealthcare(doc);
      await Portfolio.create(transformed);
      inserted++;
    } catch (err) {
      console.error(`Healthcare ${doc._id}: ${err.message}`);
    }
  }

  // Project Manager
  const pmDocs = await ProjectManagerPortfolio.find({}).lean();
  console.log(`Found ${pmDocs.length} project manager portfolios`);
  for (const doc of pmDocs) {
    if (existingIds.has(doc._id.toString())) {
      skipped++;
      continue;
    }
    try {
      const transformed = transformProjectManager(doc);
      await Portfolio.create(transformed);
      inserted++;
    } catch (err) {
      console.error(`ProjectManager ${doc._id}: ${err.message}`);
    }
  }

  // Handyman (main + gallery items)
  const handymanDocs = await HandymanMainPortfolio.find({}).lean();
  console.log(`Found ${handymanDocs.length} handyman portfolios`);
  for (const doc of handymanDocs) {
    if (existingIds.has(doc._id.toString())) {
      skipped++;
      continue;
    }
    try {
      const galleryItems = await HandymanGalleryItem.find({
        templateId: doc._id,
      }).lean();
      const transformed = transformHandyman(doc, galleryItems);
      await Portfolio.create(transformed);
      inserted++;
    } catch (err) {
      console.error(`Handyman ${doc._id}: ${err.message}`);
    }
  }

  console.log(`\nMigration complete: ${inserted} inserted, ${skipped} skipped (already exist)`);

  // Update User.portfolios references
  console.log("\nUpdating User.portfolios arrays...");
  const allNew = await Portfolio.find({}, { _id: 1, owner: 1, template: 1, visibility: 1 }).lean();
  const byOwner = new Map();
  for (const p of allNew) {
    const key = p.owner?.toString();
    if (!key) continue;
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push({
      portfolioId: p._id,
      portfolioType: p.template,
      isPublic: p.visibility === "public",
    });
  }

  let usersUpdated = 0;
  for (const [ownerId, portfolios] of byOwner) {
    try {
      await User.findByIdAndUpdate(ownerId, { portfolios });
      usersUpdated++;
    } catch (err) {
      console.error(`User ${ownerId}: ${err.message}`);
    }
  }
  console.log(`Updated ${usersUpdated} users' portfolio arrays`);

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
