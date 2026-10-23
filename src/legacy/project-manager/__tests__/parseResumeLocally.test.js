const { parseResumeLocally, sanitizePortfolio } = require("../parseResumeLocally");

describe("parseResumeLocally", () => {
  test("reads contact fields and sections without inventing dates", () => {
    const text = [
      "Jane Doe",
      "Software Engineer",
      "jane@example.com",
      "(415) 555-1212",
      "San Francisco, CA",
      "",
      "Summary",
      "Builds reliable systems.",
      "",
      "Experience",
      "Acme Corp",
      "Engineer",
      "Jan 2020 - Present",
      "Shipped the API.",
      "",
      "Education",
      "State University",
      "B.S. Computer Science",
      "2016 - 2020",
      "",
      "Skills",
      "JavaScript, Node.js, MongoDB",
      "",
      "Projects",
      "Portfolio Site",
      "A personal site",
      "https://example.com/jane",
      "",
      "https://linkedin.com/in/janedoe",
      "https://github.com/janedoe",
    ].join("\n");

    const parsed = parseResumeLocally(text);
    expect(parsed.name).toBe("Jane Doe");
    expect(parsed.title).toBe("Software Engineer");
    expect(parsed.phone).toBe("(415) 555-1212");
    expect(parsed.location).toBe("San Francisco, CA");
    expect(parsed.summary).toBe("Builds reliable systems.");
    expect(parsed.skills).toEqual(["JavaScript", "Node.js", "MongoDB"]);
    expect(parsed.experiences[0]).toEqual(expect.objectContaining({
      company: "Acme Corp",
      title: "Engineer",
      description: "Shipped the API.",
      startDate: new Date(Date.UTC(2020, 0, 1)),
    }));
    expect(parsed.experiences[0].endDate).toBeUndefined();
    expect(parsed.education[0].school).toBe("State University");
    expect(parsed.education[0].degrees).toEqual(["B.S. Computer Science"]);
    expect(parsed.education[0].startDate).toEqual(new Date(Date.UTC(2016, 0, 1)));
    expect(parsed.education[0].endDate).toEqual(new Date(Date.UTC(2020, 0, 1)));
    expect(parsed.projects[0]).toEqual(expect.objectContaining({
      name: "Portfolio Site",
      link: "https://example.com/jane",
    }));
    expect(parsed.socialLinks.linkedin).toBe("https://linkedin.com/in/janedoe");
    expect(parsed.socialLinks.github).toBe("https://github.com/janedoe");
  });

  test("drops dates and numbers the schema would reject", () => {
    const sanitized = sanitizePortfolio({
      name: "Ada",
      email: "ada@example.com",
      experiences: [{ company: "Lab", startDate: "not-a-date", endDate: "2020-05-01" }],
      education: [{ school: "School", gpa: "high", degrees: ["BA"] }],
      skills: "not-an-array",
    });
    expect(sanitized.email).toBeUndefined();
    expect(sanitized.experiences[0].startDate).toBeUndefined();
    expect(sanitized.experiences[0].endDate).toEqual(new Date(Date.UTC(2020, 4, 1)));
    expect(sanitized.education[0].gpa).toBeUndefined();
    expect(sanitized.skills).toEqual([]);
  });

  test("returns a saveable document for empty text", () => {
    const parsed = parseResumeLocally("");
    expect(parsed.name).toBe("");
    expect(parsed.skills).toEqual([]);
    expect(parsed.experiences).toEqual([]);
  });

  test("finishes adversarial 100k inputs within 200ms", () => {
    const samples = [
      "a".repeat(100000),
      "a@a.".repeat(25000),
      `Experience\n${"a".repeat(100000)}`,
    ];

    for (const sample of samples) {
      const start = process.hrtime.bigint();
      const parsed = parseResumeLocally(sample);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      expect(parsed.skills).toEqual([]);
      expect(elapsedMs).toBeLessThan(200);
    }
  });
});