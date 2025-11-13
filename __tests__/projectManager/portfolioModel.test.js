const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Portfolio = require("../../models/projectManager/portfolioModel");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Portfolio.deleteMany();
});

describe("Portfolio Model", () => {
  it("should create and save a portfolio successfully", async () => {
    const validPortfolio = new Portfolio({
      name: "John Doe",
      email: "john@test.com",
      title: "Full Stack Dev",
      skills: ["JavaScript", "React"],
      experiences: [
        { company: "ABC Corp", title: "Dev", startDate: new Date(), endDate: new Date() },
      ],
      education: [
        {
          school: "XYZ Uni",
          gpa: 3.9,
          degrees: ["BSc"],
          startDate: new Date(),
          endDate: new Date(),
        },
      ],
      projects: [{ name: "Cool Project", description: "Does cool stuff" }],
      socialLinks: {
        github: "https://github.com/john",
        linkedin: "https://linkedin.com/in/john",
      },
    });

    const saved = await validPortfolio.save();

    expect(saved._id).toBeDefined();
    expect(saved.email).toBe("john@test.com");
    expect(saved.skills).toContain("React");
    expect(saved.education[0].school).toBe("XYZ Uni");
  });

  it("should fail to save portfolio if email missing", async () => {
    const invalidPortfolio = new Portfolio({ name: "No Email" });

    let err;
    try {
      await invalidPortfolio.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
  });

  it("should not allow same email to be used twice", async () => {
    const p1 = new Portfolio({ name: "John Doe", email: "doe@test.com" });
    const p2 = new Portfolio({ name: "Jane Doe", email: "doe@test.com" });

    await p1.save();

    await expect(p2.save()).rejects.toThrow(/duplicate key/);
  });
});
