const path = require("path");
const fs = require("fs");

function loadRegistry() {
  const registryPath = path.join(__dirname, "component_registry.json");
  return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreComponent(prompt, comp) {
  const p = normalize(prompt);
  let score = 0;

  for (const kw of comp.keywords || []) {
    const k = normalize(kw);
    if (!k) continue;
    if (p.includes(k)) score += 3;         // phrase match
    else {
      // token-level match
      const tokens = k.split(" ");
      const hit = tokens.every(t => p.includes(t));
      if (hit) score += 1;
    }
  }

  return score;
}

function retrieveCandidates(userPrompt, topN = 5) {
  const reg = loadRegistry();
  const comps = reg.components || [];

  const scored = comps
    .map(c => ({ c, score: scoreComponent(userPrompt, c) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored.map(x => x.c);
}

function formatCandidatesText(candidates) {
  if (!candidates?.length) return "";

  return candidates.map(c => {
    const fe = (c.frontend?.files || []).join(", ");
    const eps = (c.backend?.endpoints || [])
      .map(e => `${e.method} ${e.path}`)
      .join(", ");
    return `ID: ${c.id} | feature: ${c.feature} | keywords: ${(c.keywords || []).slice(0,6).join(", ")} | FE: ${fe || "-"} | BE: ${eps || "-"}`;
  }).join("\n");
}

function packSelectedContext(candidates) {
  // For OpenAI: include only important integration info (short)
  return candidates.map(c => ({
    id: c.id,
    feature: c.feature,
    frontendFiles: c.frontend?.files || [],
    endpoints: c.backend?.endpoints || [],
    integrationSteps: c.integrationSteps || []
  }));
}

module.exports = { retrieveCandidates, formatCandidatesText, packSelectedContext };
