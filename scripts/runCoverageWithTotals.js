const { spawnSync } = require("child_process");
const path = require("path");

const jestJs = path.join(__dirname, "..", "node_modules", "jest", "bin", "jest.js");
const cwd = path.join(__dirname, "..");
const extra = process.argv.slice(2);

const result = spawnSync(process.execPath, [jestJs, "--coverage", ...extra], {
  cwd,
  stdio: "inherit",
  env: process.env,
});

require("./printCoverageTotals.js");

process.exit(result.status != null ? result.status : 1);
