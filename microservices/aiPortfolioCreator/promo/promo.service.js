const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");
const { planWithQwen } = require("./promo.planner");
const { retrieveCandidates, formatCandidatesText, packSelectedContext } =
  require("../utils/componentRetriever");
const { validateBackendLines } = require("../utils/backendGuard");

function detectApiHints(frontendText) {
  const endpoints = [];
  const bodyKeys = [];

  const fetchMatches = [...(frontendText || "").matchAll(/fetch\(([^)]+)\)/g)];
  for (const m of fetchMatches) {
    const s = m[1];
    const pathMatch = s.match(/\/([a-zA-Z0-9\-_/]+)('|`|")/);
    if (pathMatch) endpoints.push("/" + pathMatch[1]);
  }

  const bodyMatch = (frontendText || "").match(/body:\s*JSON\.stringify\(\s*({[\s\S]*?})\s*\)/);
  if (bodyMatch) {
    const obj = bodyMatch[1];
    const keys = [...obj.matchAll(/(\w+)\s*:/g)].map(x => x[1]);
    bodyKeys.push(...keys);
  }

  return {
    endpoints: [...new Set(endpoints)].slice(0, 5),
    bodyKeys: [...new Set(bodyKeys)].slice(0, 30),
  };
}

exports.createPromo = async ({ projectId, target, prompt }, user) => {
  console.log("\n[PROMO] createPromo called | target:", target);

  if (!projectId || !["frontend", "backend"].includes(target)) {
    throw new Error("Invalid projectId or target");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
  }

  const proj = user.projects.find(
    (p) => p.projectId === projectId && p.status !== "deleted"
  );
  if (!proj) throw new Error("Project not found");

  const frontendText = helpers.linesToTextFromObj(proj.frontendJson?.lines || {});
  const backendText = helpers.linesToTextFromObj(proj.backendJson?.lines || {});
  const apiHints = target === "backend" ? detectApiHints(frontendText) : null;

  const sourceText = target === "frontend" ? frontendText : backendText;
  const userPrompt = (prompt || "").trim();

  // ================= PLANNER =================
  const candidates = retrieveCandidates(userPrompt, 5);
  const componentsListText = formatCandidatesText(candidates);

  const plannerSourceText = target === "backend" ? frontendText : sourceText;

  const plan = await planWithQwen({
    target,
    userPrompt,
    sourceText: plannerSourceText,
    componentsListText,
  });

  const improvedPrompt = plan.rewrittenPrompt;
  const schemaGuide = plan.schemaGuide;

  // ================= SYSTEM PROMPT =================
  const systemPrompt = `
You MUST modify the TARGET file and write a short promotional tweet.

Return STRICT JSON only:
- tweet (string, max 200 chars, NO hashtags)
- frontendLines (object) if TARGET=FRONTEND
- backendLines (object) if TARGET=BACKEND

================ PRODUCTION BACKEND RULES ================

BACKEND IS ALREADY RUNNING IN PRODUCTION.
You are NOT creating a new backend.
You are editing an EXISTING production service.

🚨 ABSOLUTE PRODUCTION TRUTH 🚨

THE ONLY VALID CONTACT-SAVING ENDPOINT IS:

POST https://backend-findvirtualme.onrender.com/contactMe/ContactMeForm

This endpoint:
- already exists
- is deployed
- stores messages correctly
- MUST ALWAYS be used

❌ You are FORBIDDEN from creating, modifying, or replacing this endpoint.
❌ You are FORBIDDEN from using localhost, 127.0.0.1, or relative URLs.
❌ You are FORBIDDEN from inventing new contact routes.
❌ You are FORBIDDEN from copying reference/demo endpoints into output.

================ STRICT FORBIDDEN ACTIONS ================

❌ NEVER create a new Express app  
❌ NEVER call app.listen()  
❌ NEVER connect to mongodb://localhost  
❌ NEVER create a new MongoDB connection  
❌ NEVER hardcode ports, base URLs, or DB strings  
❌ NEVER modify server bootstrap or global middleware  
❌ NEVER rewrite the full backend file  

================ REQUIRED SAFE ACTIONS ================

✅ ONLY add or modify route handlers if explicitly required  
✅ MUST use existing environment variables  
✅ MUST keep CommonJS style (require/module.exports)  
✅ MUST return JSON in format: { success: boolean, message: string }  
✅ MUST preserve all existing functionality  
✅ MUST make MINIMAL, surgical changes  

================ FRONTEND ↔ BACKEND ALIGNMENT ================

When TARGET = FRONTEND:
- ALWAYS use the production backend:
  https://backend-findvirtualme.onrender.com
- NEVER use localhost or dev URLs
- Contact forms MUST submit to:
  /contactMe/ContactMeForm
- Request body MUST include:
  { name, email, message, portfolioId, ownerEmail, ownerName }

When TARGET = BACKEND:
- FRONTEND_CONTEXT is for REFERENCE ONLY
- Do NOT recreate frontend reference endpoints
- Do NOT mirror localhost/demo routes
- Only integrate with the existing production API if needed

================ CRITICAL FAILURE RULE ================

If ANY forbidden pattern appears (localhost, app.listen, new Express app,
new DB connection, wrong endpoint):

❌ The generation is INVALID  
❌ You MUST regenerate using ONLY safe production rules  

================ OUTPUT RULES ================

- You MUST make at least ONE valid change in the TARGET file
- ALWAYS return the FULL updated lines mapping
- Output MUST be valid JSON only
- NO markdown, NO backticks, NO explanations
`.trim();

  const selectedContext = packSelectedContext(candidates);

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `TARGET: ${target.toUpperCase()}
USER_REQUEST_RAW: ${userPrompt || "(none)"}
PLANNER_REWRITE: ${improvedPrompt || "(none)"}
SCHEMA_GUIDE: ${schemaGuide || "(none)"}

CANDIDATE_COMPONENTS:
${componentsListText || "(none)"}

SELECTED_COMPONENT_CONTEXT(JSON):
${JSON.stringify(selectedContext)}

FRONTEND_API_HINTS(JSON):
${target === "backend" ? JSON.stringify(apiHints) : "(not needed)"}

FRONTEND_CONTEXT:
${target === "backend" ? frontendText.slice(0, 8000) : "(not needed)"}

CURRENT_FILE:
${sourceText}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  };

  // ================= AUTO-RETRY SELF-HEALING LOOP =================
  let parsed = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log("[PROMO] OpenAI attempt:", attempt);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      lastError = await resp.text();
      continue;
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";

    try {
      parsed = JSON.parse(raw);
    } catch {
      lastError = "JSON parse failed";
      continue;
    }

    const linesKey = target === "frontend" ? "frontendLines" : "backendLines";
    const newLines = parsed?.[linesKey];

    // 🔒 backend safety check
    if (target === "backend" && newLines) {
      const check = validateBackendLines(newLines);

      if (!check.ok) {
        console.log("[PROMO] retry due to unsafe backend:", check.reason);

        body.messages.push({
          role: "system",
          content: `
Previous generation was rejected:
${check.reason}

Generate SAFE backend code.
Do NOT include forbidden patterns.
`,
        });

        lastError = check.reason;
        parsed = null;
        continue;
      }
    }

    // success
    break;
  }

  if (!parsed) {
    throw new Error("AI failed after retries: " + lastError);
  }

  // ================= SAVE RESULT =================
  const tweet = parsed.tweet || "";
  const linesKey = target === "frontend" ? "frontendLines" : "backendLines";
  const newLines = parsed[linesKey];

  const oldLines =
    target === "frontend"
      ? proj.frontendJson?.lines || {}
      : proj.backendJson?.lines || {};

  const changed = JSON.stringify(oldLines) !== JSON.stringify(newLines);

  console.log("[PROMO] lines changed:", changed);

  if (newLines && typeof newLines === "object") {
    if (target === "frontend") proj.frontendJson.lines = newLines;
    else proj.backendJson.lines = newLines;
  }

  proj.updatedAt = new Date();
  user.updatedAt = new Date();
  await user.save();

  return {
    ok: true,
    tweet,
    project: helpers.projectToClient(proj),
  };
};
