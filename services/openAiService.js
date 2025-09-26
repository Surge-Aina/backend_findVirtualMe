// services/openaiService.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a match summary between a resume and job description
 * @param {Object} resumeJSON - The resume data in JSON format
 * @param {string} jobText - The job description text
 * @returns {Promise<string>} A summary of matches and missing areas
 */
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


/**
 * Generate portfolio JSON from resume text
 * @param {string} resumeText - The resume text to convert
 * @param {string} email - Optional email to replace in the portfolio
 * @returns {Promise<string>} JSON string representing the portfolio
 */
async function generatePortfolioJSON(resumeText, email) {

  const jsonAIPortfolioSchema = `{"name":"","title":"","summary":"","email":"","phone":"","location":"","skills":[],"experiences":[{"company":"","title":"","location":"","startDate":"","endDate":"","description":""}],"education":[{"school":"","gpa":"","degrees":[""],"fieldOfStudy":"","awards":[""],"startDate":"","endDate":"","description":""}],"projects":[{"name":"","description":""}],"socialLinks":{"github":"","linkedin":"","website":""}}`;

  const omsJSONPortfolioAPISchema =
    '{"about":{"name":"","phone":"","address":"","linkedin":"","github":"","portfolio":"","link1":"","link2":""},"education":[{"degree":"","institution":"","year":"","points":[]}],"skills":[],"projects":[{"name":"","about":"","time":"","points":[]}],"experience":[{"company":"","role":"","duration":"","points":[]}],"certificates":[],"testimonials":[],"extraParts":[{"title":"","content":""}]}';

  let prompt = `
      Convert this resume text into valid JSON following EXACTLY this structure (keep all keys even if values are empty):

      ${jsonAIPortfolioSchema}

      Rules:
      - Output ONLY valid JSON.
      - Do NOT include Markdown code fences. (\`\`\`json or \`\`\`)
      - Keep the same keys and array structures.
      - Do not add extra keys.
      - Dates should be in YYYY-MM-DD format if available or null(without quotes)

      Resume text:
      ${resumeText}
    `;

  if (email) {
    prompt = prompt + `also replace email with ${email}`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content.trim();
}


async function generateVendorAboutAndMenuJSON(vendorText) {
  const schema = `{
    "vendor": {
      "name": "", 
      "email": "", 
      "phone": "", 
      "businessType": "", 
      "description": "", 
      "logo": ""
    },

    "about": {
      "banner": { "image": "", "title": "", "description": "", "shape": "fullscreen" },
      "contentBlocks": [{ "heading": "", "subheading": "" }],
      "gridImages": []
    },
    "menuItems": [
      { "name": "", "description": "", "price": 0, "category": "", "isAvailable": true, "unavailableUntil": null, "image": "" }
    ]
  }`;

  const prompt = `
  Convert this vendor profile text into valid JSON following EXACTLY this structure (keep all keys even if values are empty):

  ${schema}

  Rules:
  - Output ONLY valid JSON.
  - Do NOT include Markdown code fences.
  - Keep the same keys and array structures.
  - Do not add extra keys.
  - Dates should be in YYYY-MM-DD format or null.
  
  Vendor description:
  ${vendorText}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return JSON.parse(response.choices[0].message.content.trim());
}

module.exports = {
  generateMatchSummary,
  generatePortfolioJSON,
  generateVendorAboutAndMenuJSON,
};
