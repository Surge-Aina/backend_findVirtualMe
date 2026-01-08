const { userUtils, helpers } = require("../utils/aiPortfolioCreator.utils");
const { planWithQwen } = require("./promo.planner");
const { retrieveCandidates, formatCandidatesText, packSelectedContext } =
  require("../utils/componentRetriever");
const { validateBackendLines } = require("../utils/backendGuard");

function detectApiHints(frontendText) {
  const endpoints = [];
  const bodyKeys = [];

  // detect fetch calls
  const fetchMatches = [...(frontendText || "").matchAll(/fetch\(([^)]+)\)/g)];
  for (const m of fetchMatches) {
    const s = m[1];
    const pathMatch = s.match(/\/([a-zA-Z0-9\-_/]+)('|`|")/);
    if (pathMatch) endpoints.push("/" + pathMatch[1]);
  }

  // detect JSON.stringify({ ... })
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
  console.log("[PROMO] userPrompt:", (prompt || "").slice(0, 120));
  if (!projectId || !["frontend", "backend"].includes(target)) {
    throw new Error("Invalid projectId or target");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
  }

  // const user = await userUtils.getOrCreateUser(userId);
  const proj = user.projects.find(
    (p) => p.projectId === projectId && p.status !== "deleted"
  );
  if (!proj) throw new Error("Project not found");

  const frontendText = helpers.linesToTextFromObj(proj.frontendJson?.lines || {});
  const apiHints = target === "backend" ? detectApiHints(frontendText) : null;
  const backendText = helpers.linesToTextFromObj(proj.backendJson?.lines || {});

  const sourceText = target === "frontend" ? frontendText : backendText;

  const userPrompt = (prompt || "").trim();

  console.log("[PROMO] calling planner (Qwen)...");
  const candidates = retrieveCandidates(userPrompt, 5);
  const componentsListText = formatCandidatesText(candidates);

  // const plan = await planWithQwen({
  //   target,
  //   userPrompt,
  //   sourceText,
  //   componentsListText, // later add RAG candidates
  // });

    const plannerSourceText = target === "backend" ? frontendText : sourceText;

    const plan = await planWithQwen({
      target,
      userPrompt,
      sourceText: plannerSourceText,
      componentsListText,
    });

  console.log("[PROMO] planner rewrite:", (plan.rewrittenPrompt || "").slice(0, 150));
  console.log("[PROMO] planner schemaGuide:", (plan.schemaGuide || "").slice(0, 150));

  const improvedPrompt = plan.rewrittenPrompt;
  const schemaGuide = plan.schemaGuide;


//   const systemPrompt = `
// You are an assistant that edits a web scaffolding file and writes a short promotional tweet.
// Return a strict JSON object with keys:
// - "tweet": a very short promotional tweet about the project update (max 200 chars, no hashtags required).
// - "frontendLines" (optional): updated frontend lines.
// - "backendLines" (optional): updated backend lines.

// Rules:
// - If you change nothing, still return the lines mapping (unchanged).
// - Do not include markdown, backticks, or any extra text outside the JSON.
// - The file content must remain valid for its role.
// `.trim();
  const systemPrompt = `
  
  You MUST modify the TARGET file and write a short promotional tweet.

  Return STRICT JSON only:
  - tweet (string, max 200 chars, NO hashtags)
  - frontendLines (object) if TARGET=FRONTEND
  - backendLines (object) if TARGET=BACKEND

  BACKEND_CONTRACT (MUST FOLLOW):
  - Do NOT create a new Express app. Do NOT call app.listen.
  - Do NOT import express/mongoose/fs at top unless they already exist in CURRENT_FILE.
  - Use the existing server and existing MongoDB connection (MONGODB_URI already configured).
  - Do NOT use mongodb://localhost anywhere.
  - Keep the existing module style (CommonJS require/module.exports).
  - Implement ONLY new route handler(s) in the existing file structure/lines map.
  - The endpoint must match what FRONTEND_CONTEXT calls.
  - Return JSON: { success: boolean, message: string }.


  Rules:
  - You MUST make at least 1 visible change in the TARGET file based on the request.
  - Always return the full lines mapping for the TARGET.
  - If the request is broad, create a concrete section with content (e.g., an "Education" section with sample items).
  - Do not include markdown/backticks/extra text.
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

        FRONTEND_CONTEXT (for backend generation):
        ${target === "backend" ? frontendText.slice(0, 8000) : "(not needed)"}

        CURRENT_FILE:
        ${sourceText}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  };


  console.log("[PROMO] sending to OpenAI | model:", body.model);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error("OpenAI error: " + err.slice(0, 300));
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  // console.log("[PLANNER] raw:", raw.slice(0, 300));

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse model JSON");
  }

  const tweet = parsed.tweet || "";
  const linesKey = target === "frontend" ? "frontendLines" : "backendLines";
  const newLines = parsed[linesKey];
  console.log("[PROMO] OpenAI returned tweet:", tweet);
  console.log("[PROMO] updated lines received:", !!newLines);
  // 🔒 Backend safety validation
  if (target === "backend" && newLines) {
    const check = validateBackendLines(newLines);

    if (!check.ok) {
      console.log("[PROMO] backendGuard blocked output:", check.reason);

      // ❗ IMPORTANT: DO NOT save bad backend
      throw new Error(
        "Unsafe backend code generated. Reason: " + check.reason
      );
    }
  }

  const oldLines =
  target === "frontend" ? (proj.frontendJson?.lines || {}) : (proj.backendJson?.lines || {});

  const changed = JSON.stringify(oldLines) !== JSON.stringify(newLines);

  console.log("[PROMO] lines changed:", changed);
  console.log("[PROMO] old keys:", Object.keys(oldLines).length, "| new keys:", Object.keys(newLines || {}).length);


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
