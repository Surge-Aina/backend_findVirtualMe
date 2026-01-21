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
      portfolioId: "test-portfolio-123",  
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
      portfolioId: "test-portfolio-123",  
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
      portfolioId: "test-portfolio-123",  
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
  it("should fail to create user without required fields", async () => {
  await expect(
    service.createNewUser({
      email: "test@test.com",
      // Missing password, portfolioType, portfolioId
    })
  ).rejects.toThrow("required");
});

it("should fail to create duplicate user", async () => {
  const userData = {
    name: "Bob",
    username: "bob123",
    portfolioType: "photographer",
    email: "bob@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  await service.createNewUser(userData);
  
  await expect(
    service.createNewUser(userData)
  ).rejects.toThrow("already exists");
});

it("should update user information", async () => {
  const userData = {
    name: "Bob",
    username: "bob123",
    portfolioType: "photographer",
    email: "bob@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  const createdUser = await service.createNewUser(userData);

  const updatedUser = await service.updateUser({
    userId: createdUser._id,
    updatedInfo: { name: "Bob Updated", phone: "123-456-7890" }
  });

  expect(updatedUser.name).toBe("Bob Updated");
  expect(updatedUser.phone).toBe("123-456-7890");
});

it("should delete a user", async () => {
  const userData = {
    name: "Bob",
    username: "bob123",
    portfolioType: "photographer",
    email: "bob@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  const createdUser = await service.createNewUser(userData);
  const deletedUser = await service.deleteUser(createdUser._id);

  expect(deletedUser._id.toString()).toBe(createdUser._id.toString());
});

it("should get all users for a portfolio", async () => {
  const userData1 = {
    name: "User1",
    username: "user1",
    portfolioType: "photographer",
    email: "user1@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  const userData2 = {
    name: "User2",
    username: "user2",
    portfolioType: "photographer",
    email: "user2@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  await service.createNewUser(userData1);
  await service.createNewUser(userData2);

  const result = await service.getAllUsers("test-portfolio-123");

  expect(result.success).toBe(true);
  expect(result.data.length).toBe(2);
});

it("should fail login for non-existent user", async () => {
  await expect(
    service.loginUser({
      email: "notexist@test.com",
      password: "password123",
      portfolioType: "photographer",
    })
  ).rejects.toThrow("User not found");
});
});
