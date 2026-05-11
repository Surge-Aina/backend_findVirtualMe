/**
 * One-time path rewriter for B8 co-located tests. Run from backend_findVirtualMe:
 *   node scripts/b8-rewrite-test-paths.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === "coverage") continue;
      walk(p, out);
    } else if (name.name.endsWith(".test.js") || name.name === "setup.js") {
      out.push(p);
    }
  }
  return out;
}

const byPrefix = (files, relPrefix) =>
  files.filter((f) => f.replace(/\\/g, "/").includes(relPrefix));

function rewrite(file, rules) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [re, fn] of rules) {
    s = s.replace(re, fn);
  }
  if (s !== orig) fs.writeFileSync(file, s, "utf8");
}

const all = walk(path.join(root, "src"));

// --- shared/middleware/__tests__ ---
for (const f of byPrefix(all, "src/shared/middleware/__tests__")) {
  rewrite(f, [
    [/'\.\.\/\.\.\/src\/shared\//g, "'../../"],
    [/"\.\.\/\.\.\/src\/shared\//g, '"../../'],
    [/'\.\.\/\.\.\/src\/legacy\//g, "'../../../legacy/"],
    [/"\.\.\/\.\.\/src\/legacy\//g, '"../../../legacy/'],
    [/'\.\.\/\.\.\/src\/modules\//g, "'../../../modules/"],
    [/"\.\.\/\.\.\/src\/modules\//g, '"../../../modules/'],
    [/'\.\.\/\.\.\/routes\//g, "'../../../../routes/"],
    [/"\.\.\/\.\.\/routes\//g, '"../../../../routes/'],
    [/require\('\.\.\/\.\.\/src\/index'\)/g, "require('../../../index')"],
    [/require\("\.\.\/\.\.\/src\/index"\)/g, 'require("../../../index")'],
  ]);
}

// --- modules/domains/__tests__ (not fixtures) ---
for (const f of byPrefix(all, "src/modules/domains/__tests__")) {
  if (f.includes("fixtures")) continue;
  rewrite(f, [
    [/'\.\.\/\.\.\/src\/modules\/domains\//g, "'../"],
    [/"\.\.\/\.\.\/src\/modules\/domains\//g, '"../'],
    [/jest\.mock\('\.\.\/\.\.\/src\/modules\/domains\//g, "jest.mock('../"],
    [/jest\.mock\("\.\.\/\.\.\/src\/modules\/domains\//g, 'jest.mock("../'],
    [/'\.\.\/\.\.\/src\/shared\//g, "'../../shared/"],
    [/"\.\.\/\.\.\/src\/shared\//g, '"../../shared/'],
    [
      /path\.join\(__dirname, '\.\.\/fixtures\//g,
      "path.join(__dirname, 'fixtures/",
    ],
    [
      /path\.join\(__dirname, "\.\.\/fixtures\//g,
      'path.join(__dirname, "fixtures/',
    ],
  ]);
}

// --- modules/payments/__tests__ ---
for (const f of byPrefix(all, "src/modules/payments/__tests__")) {
  rewrite(f, [
    [/'\.\.\/\.\.\/src\/modules\/payments\//g, "'../"],
    [/"\.\.\/\.\.\/src\/modules\/payments\//g, '"../'],
    [/'\.\.\/src\/modules\/payments\//g, "'../"],
    [/"\.\.\/src\/modules\/payments\//g, '"../'],
    [/'\.\.\/\.\.\/src\/shared\//g, "'../../shared/"],
    [/"\.\.\/\.\.\/src\/shared\//g, '"../../shared/'],
    [/'\.\.\/src\/shared\//g, "'../../shared/"],
    [/"\.\.\/src\/shared\//g, '"../../shared/'],
    [/jest\.mock\("\.\.\/src\/shared\//g, 'jest.mock("../../shared/'],
    [/jest\.mock\('\.\.\/src\/shared\//g, "jest.mock('../../shared/"],
    [/require\("\.\.\/setup"\)/g, 'require("../../../setup.js")'],
    [/require\('\.\.\/setup'\)/g, "require('../../../setup.js')"],
    [/require\("\.\.\/__mocks__\/stripe"\)/g, 'require("../../../../__mocks__/stripe")'],
    [/require\('\.\.\/__mocks__\/stripe'\)/g, "require('../../../../__mocks__/stripe')"],
  ]);
}

// --- shared/services/__tests__ ---
for (const f of byPrefix(all, "src/shared/services/__tests__")) {
  rewrite(f, [
    [/require\("\.\.\/\.\.\/\.\.\/src\/shared\/services\//g, 'require("../'],
    [/require\('\.\.\/\.\.\/\.\.\/src\/shared\/services\//g, "require('../"],
    [/require\("\.\.\/\.\.\/src\/shared\/services\//g, 'require("../'],
    [/require\('\.\.\/\.\.\/src\/shared\/services\//g, "require('../"],
  ]);
}

// --- modules/portfolios/__tests__ ---
for (const f of byPrefix(all, "src/modules/portfolios/__tests__")) {
  rewrite(f, [
    [/'\.\.\/\.\.\/src\/modules\/portfolios\//g, "'../"],
    [/"\.\.\/\.\.\/src\/modules\/portfolios\//g, '"../'],
    [/'\.\.\/\.\.\/src\/shared\//g, "'../../shared/"],
    [/"\.\.\/\.\.\/src\/shared\//g, '"../../shared/'],
    [/'\.\.\/\.\.\/src\/modules\/domains\//g, "'../../domains/"],
    [/"\.\.\/\.\.\/src\/modules\/domains\//g, '"../../domains/'],
  ]);
}

// --- portfolio-edit-log/__tests__ ---
for (const f of byPrefix(all, "src/modules/portfolios/portfolio-edit-log/__tests__")) {
  rewrite(f, [
    [
      /'\.\.\/\.\.\/src\/modules\/portfolios\/portfolio-edit-log\//g,
      "'../",
    ],
    [
      /"\.\.\/\.\.\/src\/modules\/portfolios\/portfolio-edit-log\//g,
      '"../',
    ],
    [
      /'\.\.\/\.\.\/src\/modules\/portfolios\/portfolio-edit-log\.routes/g,
      "'../../portfolio-edit-log.routes",
    ],
    [
      /"\.\.\/\.\.\/src\/modules\/portfolios\/portfolio-edit-log\.routes/g,
      '"../../portfolio-edit-log.routes',
    ],
    [/'\.\.\/\.\.\/src\/shared\//g, "'../../../shared/"],
    [/"\.\.\/\.\.\/src\/shared\//g, '"../../../shared/'],
  ]);
}

// --- legacy/*/__tests__ ---
const legacyVerticals = [
  "healthcare",
  "project-manager",
  "local-vendor",
  "handyman",
  "photographer",
  "data-scientist",
  "software-engineer",
];
for (const v of legacyVerticals) {
  const prefix = `src/legacy/${v}/__tests__`;
  for (const f of byPrefix(all, prefix)) {
    const esc = v.replace(/-/g, "\\-");
    rewrite(f, [
      [
        new RegExp(`'\\.\\./\\.\\./src/legacy/${v}/`, "g"),
        "'../",
      ],
      [
        new RegExp(`"\\.\\./\\.\\./src/legacy/${v}/`, "g"),
        '"../',
      ],
      [/'\.\.\/\.\.\/src\/shared\//g, "'../../../shared/"],
      [/"\.\.\/\.\.\/src\/shared\//g, '"../../../shared/'],
      [/require\("\.\.\/\.\.\/setup"\)/g, 'require("../../../../setup.js")'],
      [/require\('\.\.\/\.\.\/setup'\)/g, "require('../../../../setup.js')"],
    ]);
  }
}

// --- shared/models/__tests__ (root model tests) ---
for (const f of byPrefix(all, "src/shared/models/__tests__")) {
  rewrite(f, [
    [/require\('\.\.\/\.\.\/\.\.\/src\/shared\/models\/User'\)/g, "require('../User')"],
    [/require\("\.\.\/\.\.\/\.\.\/src\/shared\/models\/User"\)/g, 'require("../User")'],
    [/require\("\.\.\/setup"\)/g, 'require("../../../setup.js")'],
    [/require\('\.\.\/setup'\)/g, "require('../../../setup.js')"],
    [/require\("\.\.\/src\/shared\/models\/Subscriptions"\)/g, 'require("../Subscriptions")'],
    [/require\('\.\.\/src\/shared\/models\/Subscriptions'\)/g, "require('../Subscriptions')"],
  ]);
}

// --- shared/models/supportForm/__tests__ ---
for (const f of byPrefix(all, "src/shared/models/supportForm/__tests__")) {
  rewrite(f, [
    [/require\('\.\.\/\.\.\/\.\.\/src\/shared\/models\/supportForm\//g, "require('../"],
    [/require\("\.\.\/\.\.\/\.\.\/src\/shared\/models\/supportForm\//g, 'require("../'],
  ]);
}

// --- modules/users/__tests__ ---
for (const f of byPrefix(all, "src/modules/users/__tests__")) {
  rewrite(f, [
    [/require\('\.\.\/\.\.\/\.\.\/src\/shared\/models\/User'\)/g, "require('../../shared/models/User')"],
    [/require\("\.\.\/\.\.\/\.\.\/src\/shared\/models\/User"\)/g, 'require("../../shared/models/User")'],
    [/require\('\.\.\/\.\.\/\.\.\/routes\/userRoute'\)/g, "require('../../../../routes/userRoute')"],
    [/require\("\.\.\/\.\.\/\.\.\/routes\/userRoute"\)/g, 'require("../../../../routes/userRoute")'],
  ]);
}

console.log("B8 path rewrite done.");
