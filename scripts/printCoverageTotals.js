const fs = require("fs");
const path = require("path");

const summaryPath = path.join(__dirname, "..", "coverage", "coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  process.exit(0);
}
let total;
try {
  ({ total } = JSON.parse(fs.readFileSync(summaryPath, "utf8")));
} catch {
  process.exit(0);
}
console.log("\n========== Coverage totals ==========");
console.log(
  `Statements ${total.statements.pct}% | Branches ${total.branches.pct}% | Functions ${total.functions.pct}% | Lines ${total.lines.pct}%`
);
console.log("HTML report: coverage/lcov-report/index.html\n");
