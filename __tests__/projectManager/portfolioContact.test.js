const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const ProjectManagerContact = require("../../models/projectManager/ProjectManagerContact");

let mongoServer;

beforeAll(async () => {
 
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
  await ProjectManagerContact.deleteMany();
});

describe("ProjectManagerContact Model Validations - BE-PM-4", () => {
  

  it("should create and save a contact successfully", async () => {
    const validContact = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      ownerName: "Portfolio Owner",
      name: "John Visitor",
      email: "visitor@test.com",
      message: "I'd like to hire you for a project"
    });

    const saved = await validContact.save();

    expect(saved._id).toBeDefined();
    expect(saved.portfolioId).toBeDefined();
    expect(saved.ownerEmail).toBe("owner@test.com");
    expect(saved.name).toBe("John Visitor");
    expect(saved.email).toBe("visitor@test.com");
    expect(saved.message).toBe("I'd like to hire you for a project");
  });

  
  it("should fail if portfolioId is missing", async () => {
    const noPortfolioId = new ProjectManagerContact({
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    let err;
    try {
      await noPortfolioId.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.portfolioId).toBeDefined();
  });

  it("should fail if ownerEmail is missing", async () => {
    const noOwnerEmail = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    let err;
    try {
      await noOwnerEmail.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.ownerEmail).toBeDefined();
  });


  it("should fail if name is missing", async () => {
    const noName = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      email: "john@test.com",
      message: "Hello"
    });

    let err;
    try {
      await noName.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

 
  it("should fail if email is missing", async () => {
    const noEmail = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      message: "Hello"
    });

    let err;
    try {
      await noEmail.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

 
  it("should fail if message is missing", async () => {
    const noMessage = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com"
    });

    let err;
    try {
      await noMessage.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.errors.message).toBeDefined();
  });

  
  it("should save without ownerName", async () => {
    const noOwnerName = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    const saved = await noOwnerName.save();

    expect(saved._id).toBeDefined();
    expect(saved.ownerName).toBeUndefined();
  });

  
  it("should default status to 'new'", async () => {
    const contact = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    const saved = await contact.save();

    expect(saved.status).toBe("new");
  });

  
  it("should accept valid status values", async () => {
    const statuses = ["new", "read", "replied"];

    for (const status of statuses) {
      const contact = new ProjectManagerContact({
        portfolioId: new mongoose.Types.ObjectId(),
        ownerEmail: "owner@test.com",
        name: "John",
        email: `john${status}@test.com`,
        message: "Hello",
        status: status
      });

      const saved = await contact.save();
      expect(saved.status).toBe(status);
    }
  });

  
  it("should reject invalid status values", async () => {
    const invalidContact = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello",
      status: "invalid-status"
    });

    let err;
    try {
      await invalidContact.save();
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
  });


  it("should have timestamps", async () => {
    const contact = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    const saved = await contact.save();

    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });

  
  it("should validate portfolioId as ObjectId", async () => {
    const validId = new mongoose.Types.ObjectId();
    const contact = new ProjectManagerContact({
      portfolioId: validId,
      ownerEmail: "owner@test.com",
      name: "John",
      email: "john@test.com",
      message: "Hello"
    });

    const saved = await contact.save();

    expect(saved.portfolioId.toString()).toBe(validId.toString());
  });

  
  it("should save with all fields including optional ones", async () => {
    const contact = new ProjectManagerContact({
      portfolioId: new mongoose.Types.ObjectId(),
      ownerEmail: "owner@test.com",
      ownerName: "Jane Portfolio Owner",
      name: "John Visitor",
      email: "visitor@test.com",
      message: "I need a project manager for my startup",
      status: "read"
    });

    const saved = await contact.save();

    expect(saved._id).toBeDefined();
    expect(saved.ownerName).toBe("Jane Portfolio Owner");
    expect(saved.status).toBe("read");
    expect(saved.message).toBe("I need a project manager for my startup");
  });
});