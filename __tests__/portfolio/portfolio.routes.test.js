const express = require("express");
const request = require("supertest");
const Portfolio = require("../../models/portfolio/Portfolio");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const mockCreate = jest.fn();

jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
);

jest.mock("../../middleware/auth", () => (req, _res, next) => {
  req.user = {
    _id: TEST_USER_ID,
    id: TEST_USER_ID,
    email: "agent@example.com",
  };
  next();
});

const portfolioRoutes = require("../../routes/portfolio.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolios", portfolioRoutes);
app.use((req, res) => res.status(404).json({ error: "not found" }));

describe("Unified portfolio routes", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("creates an agent-composed portfolio with theme metadata", async () => {
    const res = await request(app)
      .post("/api/portfolios/agent")
      .send({
        baseTemplate: "agent",
        title: "Agent-built custom portfolio",
        generationModel: "gpt-5.4",
        generationVersion: "2026-03-24",
        generationPromptHash: "abc123",
        themeId: "aurora",
        themeTokens: {
          accent: "#ff6b6b",
        },
        layoutMode: "stacked",
        sections: [
          {
            type: "contact",
            order: 3,
            data: {
              email: "builder@example.com",
              phone: "555-0100",
              location: "Remote",
            },
          },
          {
            type: "summary",
            order: 1,
            data: {
              name: "Future Builder",
              title: "Creative Technologist",
              tagline: "Care that meets you where you are",
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.portfolio.template).toBe("agent");
    expect(res.body.portfolio.createdBy).toBe("agent");
    expect(res.body.portfolio.sections).toHaveLength(2);
    expect(res.body.portfolio.sections[0].type).toBe("summary");
    expect(res.body.portfolio.sections[0].order).toBe(0);
    expect(res.body.portfolio.sections[1].type).toBe("contact");
    expect(res.body.portfolio.sections[1].order).toBe(1);
    expect(res.body.portfolio.themeId).toBe("aurora");
    expect(res.body.portfolio.layoutMode).toBe("stacked");
    expect(res.body.portfolio.themeTokens).toEqual(
      expect.objectContaining({
        accent: "#ff6b6b",
      })
    );

    const saved = await Portfolio.findById(res.body.portfolio._id).lean();
    expect(saved).toBeTruthy();
    expect(saved.createdBy).toBe("agent");
    expect(saved.generationModel).toBe("gpt-5.4");
    expect(saved.generationVersion).toBe("2026-03-24");
    expect(saved.generationPromptHash).toBe("abc123");
    expect(saved.themeId).toBe("aurora");
    expect(saved.layoutMode).toBe("stacked");
    expect(saved.themeTokens).toEqual(
      expect.objectContaining({
        accent: "#ff6b6b",
      })
    );
  });

  it("accepts caseStudy sections on agent portfolio create", async () => {
    const res = await request(app)
      .post("/api/portfolios/agent")
      .send({
        baseTemplate: "agent",
        title: "Case study portfolio",
        generationModel: "gpt-5.4",
        generationVersion: "2026-03-24",
        generationPromptHash: "abc123",
        sections: [
          {
            type: "summary",
            data: {
              name: "Alex Rivera",
              title: "Product Consultant",
            },
          },
          {
            type: "caseStudy",
            data: {
              title: "Onboarding uplift",
              client: "Northstar SaaS",
              industry: "B2B SaaS",
              challenge: "High drop-off during setup.",
              solution: "Streamlined onboarding and clearer CTAs.",
              outcome: "Higher activation and fewer support tickets.",
              metrics: ["Activation +22%", "Tickets -18%"],
              tools: ["Figma", "React"],
              link: "https://example.com/case-study",
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.portfolio.template).toBe("agent");
    const cs = res.body.portfolio.sections.find((s) => s.type === "caseStudy");
    expect(cs).toBeTruthy();
    expect(cs.data.title).toBe("Onboarding uplift");
    expect(cs.data.metrics).toEqual(["Activation +22%", "Tickets -18%"]);
  });

  it("rejects unknown block types on create with structured unsupported-block details", async () => {
    const res = await request(app)
      .post("/api/portfolios")
      .send({
        template: "healthcare",
        requestedCapability: "booking calendar",
        sections: [
          {
            type: "calendar",
            data: {},
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_BLOCK_NEED");
    expect(res.body.error).toContain("Unknown block type");
    expect(res.body.details.requestedCapability).toBe("booking calendar");
    expect(Array.isArray(res.body.details.closestKnownBlocks)).toBe(true);
    expect(res.body.details.closestKnownBlocks.length).toBeGreaterThan(0);
  });

  it("rejects unknown block types on full portfolio updates", async () => {
    const portfolio = await Portfolio.create({
      owner: TEST_USER_ID,
      template: "healthcare",
      title: "Existing portfolio",
      sections: [
        {
          type: "hero",
          order: 0,
          data: { practiceName: "Care Co" },
        },
      ],
    });

    const res = await request(app)
      .patch(`/api/portfolios/${portfolio._id}`)
      .send({
        requestedCapability: "booking calendar",
        sections: [
          {
            type: "hero",
            order: 0,
            data: { practiceName: "Care Co" },
          },
          {
            type: "calendar",
            order: 1,
            data: {},
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_BLOCK_NEED");
    expect(res.body.details.blockType).toBe("calendar");
  });

  it("rejects oversized section payloads", async () => {
    const res = await request(app)
      .post("/api/portfolios/agent")
      .send({
        baseTemplate: "healthcare",
        sections: [
          {
            type: "hero",
            data: {
              practiceName: "Big Payload Clinic",
              description: "x".repeat(60 * 1024),
            },
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SECTION_DATA_TOO_LARGE");
    expect(res.body.details.blockType).toBe("hero");
  });

  it("adds a known section and normalizes the resulting section order", async () => {
    const portfolio = await Portfolio.create({
      owner: TEST_USER_ID,
      template: "healthcare",
      title: "Existing portfolio",
      sections: [
        {
          type: "hero",
          order: 0,
          data: { practiceName: "Care Co" },
        },
      ],
    });

    const res = await request(app)
      .post(`/api/portfolios/${portfolio._id}/sections`)
      .send({
        type: "contact",
        order: 8,
        data: { email: "hello@example.com" },
      });

    expect(res.status).toBe(200);
    expect(res.body.portfolio.sections).toHaveLength(2);
    expect(res.body.portfolio.sections[0].type).toBe("hero");
    expect(res.body.portfolio.sections[0].order).toBe(0);
    expect(res.body.portfolio.sections[1].type).toBe("contact");
    expect(res.body.portfolio.sections[1].order).toBe(1);
  });

  it("returns a lightweight block catalog for agent callers", async () => {
    const res = await request(app).get("/api/portfolios/block-types?mode=agent");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        type: expect.any(String),
        label: expect.any(String),
        description: expect.any(String),
        templates: expect.any(Array),
      })
    );
  });

  it("returns the full block vocabulary for the agent template", async () => {
    const res = await request(app).get("/api/portfolios/block-types?template=agent&mode=agent");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "summary",
        "hero",
        "services",
        "projects",
        "contact",
        "dashboardChart",
        "caseStudy",
      ])
    );
  });

  it("generates an agent portfolio from a prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Northstar Growth Portfolio",
              themeId: "sunrise",
              layoutMode: "stacked",
              socialLinks: {
                linkedin: "https://linkedin.com/in/alex",
              },
              sections: [
                {
                  type: "hero",
                  data: {
                    title: "Northstar Growth",
                    subtitle: "Product strategy and lifecycle execution",
                    description: "A bold portfolio for customer-led product work.",
                    ctaText: "Start a conversation",
                    secondaryButtonText: "View work",
                  },
                },
                {
                  type: "caseStudy",
                  data: {
                    title: "Activation redesign",
                    challenge: "Users stalled during onboarding.",
                    solution: "Reduced steps and clarified value moments.",
                    outcome: "Higher activation and fewer support tickets.",
                    metrics: ["Activation +22%"],
                  },
                },
                {
                  type: "contact",
                  data: {
                    email: "agent@example.com",
                    location: "Remote",
                  },
                },
              ],
            }),
          },
        },
      ],
    });

    const res = await request(app)
      .post("/api/portfolios/agent/generate")
      .send({
        prompt: "Create a warm, product-strategy portfolio with one standout case study and a clear CTA.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe("openai");
    expect(res.body.portfolio.template).toBe("agent");
    expect(res.body.portfolio.createdBy).toBe("agent");
    expect(res.body.portfolio.themeId).toBe("sunrise");
    expect(res.body.portfolio.sections.map((section) => section.type)).toEqual([
      "hero",
      "caseStudy",
      "contact",
    ]);
    expect(res.body.portfolio.generationPromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns structured unsupported capability guidance for prompt generation", async () => {
    const res = await request(app)
      .post("/api/portfolios/agent/generate")
      .send({
        prompt: "Create a portfolio with a booking calendar and appointment scheduling flow for my clinic.",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_BLOCK_NEED");
    expect(res.body.details.blockType).toBe("booking calendar");
    expect(res.body.details.requestedCapability).toContain("booking calendar");
    expect(Array.isArray(res.body.details.closestKnownBlocks)).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
