function validateBackendLines(linesObj) {
  const txt = Object.values(linesObj || {}).join("\n");

  const forbidden = [
    "app.listen(",
    "const app = express(",
    "express()",
    "mongodb://localhost",
    "mongoose.connect(",
    "import express",
    "import mongoose"
  ];

  const hit = forbidden.find(x => txt.includes(x));
  if (hit) return { ok: false, reason: `Forbidden backend pattern: ${hit}` };

  return { ok: true };
}

module.exports = { validateBackendLines };
