const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const router = require("../guestUser.routes");
process.env.JWT_SECRET = "test-secret-key-12345";

let mongoServer;
const app = express();
app.use(bodyParser.json());
app.use("/api/users", router);

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

describe("GuestUser Controllers", () => {
  it("POST /signup should create a user", async () => {
    const res = await request(app).post("/api/users/signup").send({
      name: "Charlie",
      username: "charlie123",
      portfolioType: "photographer",
      email: "charlie@test.com",
      password: "password123",
        portfolioId: "test-portfolio-123",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.email).toBe("charlie@test.com");
  });

  it("POST /login should login a user", async () => {
    await request(app).post("/api/users/signup").send({
      name: "Charlie",
      username: "charlie123",
      portfolioType: "photographer",
      email: "charlie@test.com",
      password: "password123",
      portfolioId: "test-portfolio-123"

    });

    const res = await request(app).post("/api/users/login").send({
      email: "charlie@test.com",
      password: "password123",
      portfolioType: "photographer",
       portfolioId: "test-portfolio-123"
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("charlie@test.com");
  });
it("PATCH /editProfile should update user info", async () => {
    // Create user
    await request(app).post("/api/users/signup").send({
      name: "Charlie",
      username: "charlie123",
      portfolioType: "photographer",
      email: "charlie@test.com",
      password: "password123",
      portfolioId: "test-portfolio-123",
    });

    // Login to get token
    const loginRes = await request(app).post("/api/users/login").send({
      email: "charlie@test.com",
      password: "password123",
      portfolioType: "photographer",
    });

    const token = loginRes.body.token;

    // Update user - CHANGED TO PATCH AND /editProfile
    const res = await request(app)
      .patch("/api/users/editProfile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Charlie Updated",
        phone: "123-456-7890"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe("Charlie Updated");
  });

  it("DELETE /deleteProfile should delete a user", async () => {
    // Create user
    await request(app).post("/api/users/signup").send({
      name: "Charlie",
      username: "charlie123",
      portfolioType: "photographer",
      email: "charlie@test.com",
      password: "password123",
      portfolioId: "test-portfolio-123",
    });

    // Login to get token
    const loginRes = await request(app).post("/api/users/login").send({
      email: "charlie@test.com",
      password: "password123",
      portfolioType: "photographer",
    });

    const token = loginRes.body.token;

    // Delete user - CHANGED TO /deleteProfile
    const res = await request(app)
      .delete("/api/users/deleteProfile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("User deleted successfully");
  });
  it("POST /signup should fail with missing fields", async () => {
  const res = await request(app).post("/api/users/signup").send({
    email: "test@test.com",
    // Missing password, portfolioType, portfolioId
  });

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toContain("required");
});

it("POST /signup should fail with duplicate user", async () => {
  const userData = {
    name: "Charlie",
    username: "charlie123",
    portfolioType: "photographer",
    email: "charlie@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  };

  // Create user first time
  await request(app).post("/api/users/signup").send(userData);

  // Try to create again - should fail
  const res = await request(app).post("/api/users/signup").send(userData);

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toContain("already exists");
});

it("POST /login should fail with wrong password", async () => {
  await request(app).post("/api/users/signup").send({
    name: "Charlie",
    username: "charlie123",
    portfolioType: "photographer",
    email: "charlie@test.com",
    password: "password123",
    portfolioId: "test-portfolio-123",
  });

  const res = await request(app).post("/api/users/login").send({
    email: "charlie@test.com",
    password: "wrongpassword",
    portfolioType: "photographer",
  });

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toContain("Invalid credentials");
});

it("POST /login should fail for non-existent user", async () => {
  const res = await request(app).post("/api/users/login").send({
    email: "notexist@test.com",
    password: "password123",
    portfolioType: "photographer",
  });

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toContain("User not found");
});
});

  

