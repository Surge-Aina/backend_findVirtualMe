/**
 * Orchestrates v2 portfolio migration stages with stop-on-failure gates.
 *
 * Default flow:
 *   1) dry-run migrate
 *   2) canary migrate + verify
 *   3) full migrate + verify
 *
 * Usage examples:
 *   node scripts/runV2PortfolioMigrationRollout.js
 *   node scripts/runV2PortfolioMigrationRollout.js --limit=25
 *   node scripts/runV2PortfolioMigrationRollout.js --templates=healthcare,projectManager,handyman --reports-dir=./reports
 *   node scripts/runV2PortfolioMigrationRollout.js --from=canary --limit=25
 *   node scripts/runV2PortfolioMigrationRollout.js --through=canary --limit=25
 */

const path = require("path");
const { spawnSync } = require("child_process");

const SUPPORTED_TEMPLATES = ["healthcare", "projectManager", "handyman"];
const STAGES = ["dry-run", "canary", "full"];

function parseArgs(argv) {
  const options = {
    templates: [...SUPPORTED_TEMPLATES],
    limit: 25,
    reportsDir: "./reports",
    dnsServers: [],
    skipUnresolvedOwners: false,
    fromStage: "dry-run",
    throughStage: "full",
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("--templates=")) {
      const selected = (arg.split("=")[1] || "")
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
    if (arg.startsWith("--reports-dir=")) {
      const value = (arg.split("=")[1] || "").trim();
      if (!value) {
        throw new Error("--reports-dir requires a path");
      }
      options.reportsDir = value;
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
    if (arg.startsWith("--from=")) {
      const value = (arg.split("=")[1] || "").trim();
      if (!STAGES.includes(value)) {
        throw new Error(`--from must be one of: ${STAGES.join(", ")}`);
      }
      options.fromStage = value;
      continue;
    }
    if (arg.startsWith("--through=")) {
      const value = (arg.split("=")[1] || "").trim();
      if (!STAGES.includes(value)) {
        throw new Error(`--through must be one of: ${STAGES.join(", ")}`);
      }
      options.throughStage = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const fromIndex = STAGES.indexOf(options.fromStage);
  const throughIndex = STAGES.indexOf(options.throughStage);
  if (fromIndex > throughIndex) {
    throw new Error("--from cannot come after --through");
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/runV2PortfolioMigrationRollout.js [options]

Options:
  --templates=...      Comma-separated templates (healthcare, projectManager, handyman)
  --limit=...          Canary limit (default 25)
  --reports-dir=...    Output directory for report JSON files (default ./reports)
  --dns-servers=...    Optional DNS servers for child migration/verify scripts
  --skip-unresolved-owners
                     Skip projectManager records with unresolved owners in migration
  --from=...           Start stage: dry-run | canary | full (default dry-run)
  --through=...        End stage: dry-run | canary | full (default full)
  --help, -h           Show this help
  `);
}

function stageEnabled(stage, options) {
  const index = STAGES.indexOf(stage);
  const from = STAGES.indexOf(options.fromStage);
  const through = STAGES.indexOf(options.throughStage);
  return index >= from && index <= through;
}

function runCommand(label, args) {
  console.log(`\n== ${label} ==`);
  console.log(`node ${args.join(" ")}`);

  const result = spawnSync("node", args, {
    stdio: "inherit",
    shell: false,
    cwd: path.resolve(__dirname, ".."),
  });

  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function buildTemplateArg(templates) {
  return `--templates=${templates.join(",")}`;
}

function buildDnsArgs(dnsServers) {
  if (!dnsServers.length) return [];
  return [`--dns-servers=${dnsServers.join(",")}`];
}

function buildOwnerSkipArgs(enabled) {
  return enabled ? ["--skip-unresolved-owners"] : [];
}

function reportPath(reportsDir, filename) {
  return `--report-json=${path.join(reportsDir, filename)}`;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const templateArg = buildTemplateArg(options.templates);
    const dnsArgs = buildDnsArgs(options.dnsServers);
    const ownerSkipArgs = buildOwnerSkipArgs(options.skipUnresolvedOwners);

    if (stageEnabled("dry-run", options)) {
      runCommand("Dry-run migration", [
        "scripts/migratePortfolios.js",
        "--dry-run",
        templateArg,
        ...dnsArgs,
        ...ownerSkipArgs,
        reportPath(options.reportsDir, "migration-dry-run.json"),
      ]);
    }

    if (stageEnabled("canary", options)) {
      runCommand("Repair handyman contact (pre-verify)", [
        "scripts/repairHandymanContact.js",
        ...dnsArgs,
        reportPath(options.reportsDir, "repair-handyman-contact-canary.json"),
      ]);
      runCommand("Repair projectManager summary email (pre-verify)", [
        "scripts/repairProjectManagerSummaryEmail.js",
        ...dnsArgs,
        reportPath(options.reportsDir, "repair-projectmanager-summary-email-canary.json"),
      ]);

      runCommand("Canary migration", [
        "scripts/migratePortfolios.js",
        templateArg,
        `--limit=${options.limit}`,
        ...dnsArgs,
        ...ownerSkipArgs,
        reportPath(options.reportsDir, "migration-canary.json"),
      ]);
      runCommand("Canary verification", [
        "scripts/verifyPortfolioMigration.js",
        templateArg,
        `--limit=${options.limit}`,
        ...dnsArgs,
        ...(options.skipUnresolvedOwners
          ? ["--allow-missing-v2", "--allow-orphaned-owners", "--allow-handyman-missing-contact"]
          : []),
        reportPath(options.reportsDir, "verify-canary.json"),
      ]);
    }

    if (stageEnabled("full", options)) {
      runCommand("Repair handyman contact (pre-verify)", [
        "scripts/repairHandymanContact.js",
        ...dnsArgs,
        reportPath(options.reportsDir, "repair-handyman-contact-full.json"),
      ]);
      runCommand("Repair projectManager summary email (pre-verify)", [
        "scripts/repairProjectManagerSummaryEmail.js",
        ...dnsArgs,
        reportPath(options.reportsDir, "repair-projectmanager-summary-email-full.json"),
      ]);

      runCommand("Full migration", [
        "scripts/migratePortfolios.js",
        templateArg,
        ...dnsArgs,
        ...ownerSkipArgs,
        reportPath(options.reportsDir, "migration-full.json"),
      ]);
      runCommand("Full verification", [
        "scripts/verifyPortfolioMigration.js",
        templateArg,
        ...dnsArgs,
        ...(options.skipUnresolvedOwners
          ? ["--allow-missing-v2", "--allow-orphaned-owners", "--allow-handyman-missing-contact"]
          : []),
        reportPath(options.reportsDir, "verify-full.json"),
      ]);
    }

    console.log("\nRollout completed successfully.");
  } catch (err) {
    console.error(`\nRollout stopped: ${err.message}`);
    process.exit(1);
  }
}

main();
