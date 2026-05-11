/**
 * Update __tests__ requires after legacy MVC moved under src/legacy/.
 * Run once: node scripts/b2-patch-tests-after-legacy-move.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "__tests__");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, files);
    else if (name.isFile() && name.name.endsWith(".js")) files.push(p);
  }
  return files;
}

const subs = [
  ["../../models/projectManager/", "../../src/legacy/project-manager/models/"],
  ["../../../models/projectManager/", "../../../src/legacy/project-manager/models/"],
  ["../../models/handyMan/", "../../src/legacy/handyman/models/"],
  ["../../models/localFoodVendor/", "../../src/legacy/local-vendor/models/"],
  ["../../models/dataScientist/", "../../src/legacy/data-scientist/models/"],
  ["../../models/healthcare/", "../../src/legacy/healthcare/models/"],
  ["../../models/photographer/", "../../src/legacy/photographer/models/"],
  ["../../controllers/handyman/", "../../src/legacy/handyman/controllers/"],
  ["../../controllers/localFoodVendor/", "../../src/legacy/local-vendor/controllers/"],
  ["../../controllers/projectManager/", "../../src/legacy/project-manager/controllers/"],
  ["../../controllers/dataScientist/", "../../src/legacy/data-scientist/controllers/"],
  ["../../controllers/photographer/", "../../src/legacy/photographer/controllers/"],
  ["../../routes/handyMan/", "../../src/legacy/handyman/routes/"],
  ["../../routes/localFoodVendor/", "../../src/legacy/local-vendor/routes/"],
  ["../../routes/projectManager/", "../../src/legacy/project-manager/routes/"],
  ["../../routes/dataScientist/", "../../src/legacy/data-scientist/routes/"],
  ["../../routes/photographer/", "../../src/legacy/photographer/routes/"],
  ["../../routes/healthcare/", "../../src/legacy/healthcare/routes/"],
];

const files = walk(root);
let n = 0;
for (const file of files) {
  let c = fs.readFileSync(file, "utf8");
  const before = c;
  for (const [a, b] of subs) {
    c = c.split(a).join(b);
  }
  if (c !== before) {
    fs.writeFileSync(file, c, "utf8");
    n++;
  }
}
console.log("Updated", n, "test files");
