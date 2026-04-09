/**
 * Verification script for legacy -> portfolios_v2 migration.
 *
 * Usage:
 *   MONGODB_URI=mongodb://... node scripts/verifyPortfolioMigration.js
 *   MONGODB_URI=mongodb://... node scripts/verifyPortfolioMigration.js --templates=healthcare,projectManager --limit=50
 *   MONGODB_URI=mongodb://... node scripts/verifyPortfolioMigration.js --report-json=./verify-report.json
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");

const HealthcarePortfolio = require("../models/healthcare/userData");
const ProjectManagerPortfolio = require("../models/projectManager/portfolioModel");
const HandymanMainPortfolio = require("../models/handyMan/HandymanTemplate");
const Portfolio = require("../models/portfolio/Portfolio");
const User = require("../models/User");

const SUPPORTED_TEMPLATES = ["healthcare", "projectManager", "handyman"];
const EXPECTED_SECTION_TYPES = {
  healthcare: ["hero", "stats", "services", "gallery", "blog", "contact", "hours", "seo"],
  projectManager: ["summary", "skills", "experience", "education", "projects", "contact"],
  handyman: ["hero", "services", "gallery", "process", "testimonials", "contact"],
};

function toBool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function parseArgs(argv) {
  const options = {
    templates: [...SUPPORTED_TEMPLATES],
    limit: null,
    reportJsonPath: "",
    dnsServers: [],
    allowMissingV2: false,
    allowOrphanedOwners: false,
    allowHandymanMissingContact: false,
    help: false,
  };

  for (const arg of argv) {
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
      const value = Number(arg.split("=")[1]);
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
    if (arg === "--allow-missing-v2") {
      options.allowMissingV2 = true;
      continue;
    }
    if (arg === "--allow-orphaned-owners") {
      options.allowOrphanedOwners = true;
      continue;
    }
    if (arg === "--allow-handyman-missing-contact") {
      options.allowHandymanMissingContact = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/verifyPortfolioMigration.js [--templates=healthcare,projectManager,handyman] [--limit=50] [--report-json=path] [--dns-servers=8.8.8.8,1.1.1.1]

Options:
  --templates=...      Comma-separated templates to verify (healthcare, projectManager, handyman)
  --limit=...          Max number of legacy docs checked per selected template
  --report-json=...    Write machine-readable report JSON to the provided path
  --dns-servers=...    Optional DNS servers used for SRV lookup in this Node process
  --allow-missing-v2   Do not fail verification when a legacy doc has no v2 doc (still reported)
  --allow-orphaned-owners
                     Do not fail verification when v2 owner user is missing / user references mismatch (still reported)
  --allow-handyman-missing-contact
                     Do not fail verification on handyman portfolios missing contact phone/email (still reported)
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

function writeJsonReport(filePath, report) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const directory = path.dirname(absolutePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

function createTemplateResult() {
  return {
    checked: 0,
    missingV2: 0,
    templateMismatches: 0,
    ownerMissing: 0,
    sectionIssues: 0,
    criticalFieldIssues: 0,
    userReferenceIssues: 0,
    failures: [],
  };
}

function recordFailure(target, template, legacyId, reason) {
  target.failures.push({
    template,
    legacyId: legacyId ? legacyId.toString() : "",
    reason,
  });
}

function getCriticalFieldChecks(template, legacyDoc, v2Doc) {
  if (template === "healthcare") {
    const hero = (v2Doc.sections || []).find((section) => section.type === "hero");
    return [
      {
        name: "owner",
        valid: !!v2Doc.owner,
      },
      {
        name: "title",
        valid: !!(v2Doc.title || "").trim(),
      },
      {
        name: "hero.practiceName",
        valid:
          !!((hero?.data?.practiceName || "").trim()) ||
          !!((legacyDoc.practice?.name || "").trim() === ""),
      },
    ];
  }

  if (template === "projectManager") {
    const summary = (v2Doc.sections || []).find((section) => section.type === "summary");
    return [
      {
        name: "owner",
        valid: !!v2Doc.owner,
      },
      {
        name: "title",
        valid: !!(v2Doc.title || "").trim(),
      },
      {
        name: "summary.email",
        valid: !!((summary?.data?.email || "").trim() || (legacyDoc.email || "").trim()),
      },
    ];
  }

  const contact = (v2Doc.sections || []).find((section) => section.type === "contact");
  return [
    {
      name: "owner",
      valid: !!v2Doc.owner,
    },
    {
      name: "title",
      valid: !!(v2Doc.title || "").trim(),
    },
    {
      name: "contact.phoneOrEmail",
      valid: !!((contact?.data?.phone || "").trim() || (contact?.data?.email || "").trim()),
    },
  ];
}

function hasAllExpectedSections(template, v2Doc) {
  const expected = EXPECTED_SECTION_TYPES[template] || [];
  const actual = new Set((v2Doc.sections || []).map((section) => section.type));
  const missing = expected.filter((type) => !actual.has(type));
  return {
    ok: missing.length === 0,
    missing,
  };
}

async function loadLegacyDocs(template, limit) {
  const findOptions = limit ? { limit } : {};
  if (template === "healthcare") {
    return HealthcarePortfolio.find({}, null, findOptions).lean();
  }
  if (template === "projectManager") {
    return ProjectManagerPortfolio.find({}, null, findOptions).lean();
  }
  return HandymanMainPortfolio.find({}, null, findOptions).lean();
}

function normalizePortfolioEntryId(value) {
  if (!value) return "";
  return value.toString();
}

async function verify(options) {
  const dnsServers = resolveDnsServers(options);
  if (dnsServers.length) {
    dns.setServers(dnsServers);
    console.log(`Using custom DNS servers for verification: ${dnsServers.join(", ")}`);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Set MONGODB_URI or MONGO_URI in env");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const report = {
    startedAt: new Date().toISOString(),
    options: {
      templates: options.templates,
      limit: options.limit,
      dnsServers,
      allowMissingV2: options.allowMissingV2,
      allowOrphanedOwners: options.allowOrphanedOwners,
      allowHandymanMissingContact: options.allowHandymanMissingContact,
    },
    templates: {},
    totals: {
      checked: 0,
      missingV2: 0,
      templateMismatches: 0,
      ownerMissing: 0,
      sectionIssues: 0,
      criticalFieldIssues: 0,
      handymanMissingContactIssues: 0,
      userReferenceIssues: 0,
      failures: 0,
    },
  };

  for (const template of options.templates) {
    report.templates[template] = createTemplateResult();
    const result = report.templates[template];
    const legacyDocs = await loadLegacyDocs(template, options.limit);

    for (const legacyDoc of legacyDocs) {
      result.checked += 1;
      report.totals.checked += 1;

      const v2Doc = await Portfolio.findById(legacyDoc._id).lean();
      if (!v2Doc) {
        result.missingV2 += 1;
        report.totals.missingV2 += 1;
        recordFailure(result, template, legacyDoc._id, "Missing portfolios_v2 document by _id");
        continue;
      }

      if (v2Doc.template !== template) {
        result.templateMismatches += 1;
        report.totals.templateMismatches += 1;
        recordFailure(
          result,
          template,
          legacyDoc._id,
          `Template mismatch: expected ${template}, got ${v2Doc.template || "unknown"}`
        );
      }

      if (!v2Doc.owner) {
        result.ownerMissing += 1;
        report.totals.ownerMissing += 1;
        recordFailure(result, template, legacyDoc._id, "Missing owner on v2 document");
      }

      const sectionCheck = hasAllExpectedSections(template, v2Doc);
      if (!sectionCheck.ok) {
        result.sectionIssues += 1;
        report.totals.sectionIssues += 1;
        recordFailure(
          result,
          template,
          legacyDoc._id,
          `Missing expected sections: ${sectionCheck.missing.join(", ")}`
        );
      }

      const criticalChecks = getCriticalFieldChecks(template, legacyDoc, v2Doc);
      const failingCriticalChecks = criticalChecks.filter((check) => !check.valid);
      if (failingCriticalChecks.length) {
        const failingNames = failingCriticalChecks.map((item) => item.name);
        const onlyMissingHandymanContact =
          template === "handyman" &&
          failingNames.length === 1 &&
          failingNames[0] === "contact.phoneOrEmail";

        if (onlyMissingHandymanContact) {
          report.totals.handymanMissingContactIssues += 1;
        } else {
          result.criticalFieldIssues += 1;
          report.totals.criticalFieldIssues += 1;
        }

        recordFailure(
          result,
          template,
          legacyDoc._id,
          `Critical field checks failed: ${failingNames.join(", ")}`
        );
      }

      const user = v2Doc.owner ? await User.findById(v2Doc.owner).select("portfolios").lean() : null;
      if (!user) {
        result.userReferenceIssues += 1;
        report.totals.userReferenceIssues += 1;
        recordFailure(result, template, legacyDoc._id, "Owner user not found for v2 document");
      } else {
        const matchedEntry = (user.portfolios || []).find((entry) => {
          return normalizePortfolioEntryId(entry.portfolioId) === v2Doc._id.toString();
        });

        if (!matchedEntry) {
          result.userReferenceIssues += 1;
          report.totals.userReferenceIssues += 1;
          recordFailure(result, template, legacyDoc._id, "User.portfolios missing migrated portfolio reference");
        } else {
          const expectedIsPublic = v2Doc.visibility === "public";
          if (
            matchedEntry.portfolioType !== template ||
            Boolean(matchedEntry.isPublic) !== expectedIsPublic
          ) {
            result.userReferenceIssues += 1;
            report.totals.userReferenceIssues += 1;
            recordFailure(
              result,
              template,
              legacyDoc._id,
              `User reference mismatch: expected {portfolioType:${template}, isPublic:${expectedIsPublic}}`
            );
          }
        }
      }
    }

    report.totals.failures += result.failures.length;
  }

  report.completedAt = new Date().toISOString();

  console.log("\nVerification summary:");
  console.log(JSON.stringify(report, null, 2));

  if (options.reportJsonPath) {
    const outputPath = writeJsonReport(options.reportJsonPath, report);
    console.log(`\nVerification report written to ${outputPath}`);
  }

  await mongoose.disconnect();
  console.log("Done.");

  const allowMissingV2 = toBool(options.allowMissingV2);
  const allowOrphanedOwners = toBool(options.allowOrphanedOwners);
  const allowHandymanMissingContact = toBool(options.allowHandymanMissingContact);

  let effectiveFailures = report.totals.failures;
  if (allowMissingV2) {
    effectiveFailures -= report.totals.missingV2;
  }
  if (allowOrphanedOwners) {
    effectiveFailures -= report.totals.userReferenceIssues;
  }
  if (allowHandymanMissingContact) {
    effectiveFailures -= report.totals.handymanMissingContactIssues;
  }
  if (effectiveFailures < 0) effectiveFailures = 0;

  if (effectiveFailures > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    await verify(options);
  } catch (err) {
    console.error("Verification failed:", err?.message || err);
    process.exit(1);
  }
}

main();
