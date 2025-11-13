const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const GuestUser = require("../guestUser.model");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("GuestUser Model", () => {
  it("should create & save a user successfully", async () => {
    const userData = {
      name: "Alice",
      username: "alice123",
      portfolioType: "photographer",
      email: "alice@test.com",
      password: "password123",
      portfolioId: "test-portfolio-123",
    };

    const user = new GuestUser(userData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.toJSON().password).toBeUndefined(); // removed in toJSON
  });

  it("should fail if required fields are missing", async () => {
    const user = new GuestUser({ email: "test@test.com" });
    let err;
    try {
      await user.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
  });
});
