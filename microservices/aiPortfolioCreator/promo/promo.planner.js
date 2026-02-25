// microservices/aiPortfolioCreator/promo/promo.planner.js

async function planWithQwen({ target, userPrompt, sourceText, componentsListText = "" }) {
    console.log("[PLANNER] planWithQwen running | enabled:", process.env.PLANNER_ENABLED);

  // planner off → pass-through
  if (process.env.PLANNER_ENABLED !== "true") {
    return {
      rewrittenPrompt: userPrompt,
      schemaGuide: "",
      selectedComponentIds: [],
      questions: [],
    };
  }
    const baseUrl = process.env.PLANNER_BASE_URL || "http://localhost:1234";
  const model = process.env.PLANNER_MODEL || "qwen2.5-7b-instruct";
  const apiKey = process.env.PLANNER_API_KEY || "lm-studio";
  const timeoutMs = Number(process.env.PLANNER_TIMEOUT_MS || 20000);

  console.log("[PLANNER] calling LM Studio | model:", model, "| baseUrl:", baseUrl);


  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const system = `
You are a planner assistant. Do NOT edit code.
Your job: rewrite the user's request into precise instructions for a coding model.

Return STRICT JSON with keys:
- rewrittenPrompt (string)
- schemaGuide (string)
- selectedComponentIds (array of strings)
- questions (array of strings)

Rules:
- No markdown/backticks.
- Be explicit about what must be added/changed.
- If relevant, say WHERE changes belong (schemaGuide).
- Prefer selecting from AVAILABLE_COMPONENTS; only include IDs from that list.
`.trim();

  const user = `
TARGET: ${target}
USER_PROMPT: ${userPrompt}

AVAILABLE_COMPONENTS:
${componentsListText || "(none)"}

CURRENT_FILE_CONTEXT (truncated):
${(sourceText || "").slice(0, 8000)}
`.trim();

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    // If LM Studio ever complains, remove this line and rely on strict prompt
    response_format: { type: "json_object" },
  };

  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return {
        rewrittenPrompt: userPrompt,
        schemaGuide: "",
        selectedComponentIds: [],
        questions: [],
        plannerError: err.slice(0, 200),
      };
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    console.log("[PLANNER] LM Studio raw response:", raw.slice(0, 300));

    const parsed = JSON.parse(raw);
    return {
      rewrittenPrompt: parsed.rewrittenPrompt || userPrompt,
      schemaGuide: parsed.schemaGuide || "",
      selectedComponentIds: Array.isArray(parsed.selectedComponentIds) ? parsed.selectedComponentIds : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch (e) {
    console.log("[PLANNER] exception:", e);

    return {
      rewrittenPrompt: userPrompt,
      schemaGuide: "",
      selectedComponentIds: [],
      questions: [],
      plannerError: String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { planWithQwen };
