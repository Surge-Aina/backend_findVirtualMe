// services/openaiService.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

async function generateMatchSummary(resumeJSON, jobText) {
  const prompt = `
    Match this resume to the job. List strong matches and missing areas briefly (max 150 words).

    Resume:
    ${JSON.stringify(resumeJSON, null, 2)}

    Job Description:
    ${jobText}

    Output format:
    ✓ Matches: skill1, skill2


    ✗ Missing: skill3, skill4

    
    Summary: [very short overall assessment]
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  return response.choices[0].message.content.trim();
}

async function generatePortfolioJSON(resumeText){
    const prompt = `
    Convert this resume text into JSON format using the following structure:

    {"about":{"name":"","phone":"","address":"","linkedin":"","github":"","portfolio":"","link1":"","link2":""},"education":[{"degree":"","institution":"","year":"","points":[]}],"skills":[],"projects":[{"name":"","about":"","time":"","points":[]}],"experience":[{"company":"","role":"","duration":"","points":[]}],"certificates":[],"testimonials":[],"extraParts":[{"title":"","content":""}]}
   

    ${resumeText}
    `;

    const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generateMatchSummary, generatePortfolioJSON };
