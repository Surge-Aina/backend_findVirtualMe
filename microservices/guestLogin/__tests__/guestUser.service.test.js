const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const service = require("../guestUser.service");

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

describe("GuestUser Service", () => {
  it("should create a new user", async () => {
    const userData = {
      name: "Bob",
      username: "bob123",
      portfolioType: "photographer",
      email: "bob@test.com",
      password: "password123",
    };

    const user = await service.createNewUser(userData);

    expect(user._id).toBeDefined();
    expect(user.email).toBe(userData.email);
  });

  it("should login a user with correct credentials", async () => {
    const userData = {
      name: "Bob",
      username: "bob123",
      portfolioType: "photographer",
      email: "bob@test.com",
      password: "password123",
    };

    await service.createNewUser(userData);

    const { token, user } = await service.loginUser({
      email: userData.email,
      password: userData.password,
      portfolioType: userData.portfolioType,
    });

    expect(token).toBeDefined();
    expect(user.email).toBe(userData.email);
  });

  it("should fail login with wrong password", async () => {
    const userData = {
      name: "Bob",
      username: "bob123",
      portfolioType: "photographer",
      email: "bob@test.com",
      password: "password123",
    };

    await service.createNewUser(userData);

    await expect(
      service.loginUser({
        email: userData.email,
        password: "wrongpassword",
        portfolioType: userData.portfolioType,
      })
    ).rejects.toThrow("Invalid credentials");
  });
});
