const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Portfolio = require("../../models/projectManager/portfolioModel");

let mongoServer;
beforeAll(async () => {
  // Disconnect if already connected
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  await Portfolio.deleteMany();
});

describe("Portfolio Model Validations - BE-PM-4", () => {
  
  //  Create portfolio 
  it("should create and save a portfolio successfully", async () => {
    const validPortfolio = new Portfolio({
      name: "John Doe",
      email: "john@test.com",
      title: "Project Manager",
      skills: ["MERN"],
      experiences: [
        { company: "Surge Aina", title: "PM", startDate: new Date(), endDate: new Date() }
      ],
      education: [
        { school: "MIT", gpa: 3.9, degrees: ["BSc"], startDate: new Date(), endDate: new Date() }
      ],
      projects: [
        { name: "Portfolio Project", description: "Project description" }
      ],
      socialLinks: {
        github: "https://github.com/john",
        linkedin: "https://linkedin.com/in/john"
      }
    });

    const saved = await validPortfolio.save();

    expect(saved._id).toBeDefined();
    expect(saved.email).toBe("john@test.com");
    expect(saved.name).toBe("John Doe");
    expect(saved.skills).toContain("MERN");
  });

  // Email  required
  it("should fail if email is missing", async () => {
    const noEmail = new Portfolio({ name: "No Email" });

    let err;
    try {
      await noEmail.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  //  Email  unique
  it("should not allow duplicate emails", async () => {
    const p1 = new Portfolio({ name: "John", email: "duplicate@test.com" });
    const p2 = new Portfolio({ name: "Jane", email: "duplicate@test.com" });

    await p1.save();
    await expect(p2.save()).rejects.toThrow(/duplicate key/);
  });

  it("should save with only email", async () => {
    const minimal = new Portfolio({ email: "minimal@test.com" });
    
    const saved = await minimal.save();
    
    expect(saved._id).toBeDefined();
    expect(saved.email).toBe("minimal@test.com");
  });

  // Arrays work correctly
  it("should save with multiple skills", async () => {
    const portfolio = new Portfolio({
      email: "skills@test.com",
      skills: ["Skill1", "Skill2", "Skill3"]
    });

    const saved = await portfolio.save();

    expect(saved.skills).toHaveLength(3);
    expect(saved.skills).toContain("Skill2");
  });


  it("should save with experience data", async () => {
    const portfolio = new Portfolio({
      email: "exp@test.com",
      experiences: [
        { company: "Company A", title: "Role A" },
        { company: "Company B", title: "Role B" }
      ]
    });

    const saved = await portfolio.save();

    expect(saved.experiences).toHaveLength(2);
    expect(saved.experiences[0].company).toBe("Company A");
  });

  it("should save with education data", async () => {
    const portfolio = new Portfolio({
      email: "edu@test.com",
      education: [
        { school: "Harvard", gpa: 4.0, degrees: ["MBA"] }
      ]
    });

    const saved = await portfolio.save();

    expect(saved.education).toHaveLength(1);
    expect(saved.education[0].school).toBe("Harvard");
    expect(saved.education[0].gpa).toBe(4.0);
  });

  it("should save with projects data", async () => {
    const portfolio = new Portfolio({
      email: "proj@test.com",
      projects: [
        { name: "Project X", description: "Description X" }
      ]
    });

    const saved = await portfolio.save();

    expect(saved.projects).toHaveLength(1);
    expect(saved.projects[0].name).toBe("Project X");
  });

  it("should save with social links", async () => {
    const portfolio = new Portfolio({
      email: "social@test.com",
      socialLinks: {
        github: "https://github.com/user",
        linkedin: "https://linkedin.com/in/user",
        website: "https://mysite.com"
      }
    });

    const saved = await portfolio.save();

    expect(saved.socialLinks.github).toBe("https://github.com/user");
    expect(saved.socialLinks.linkedin).toBe("https://linkedin.com/in/user");
  });


  it("should have timestamps", async () => {
    const portfolio = new Portfolio({ email: "time@test.com" });

    const saved = await portfolio.save();

    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });
});