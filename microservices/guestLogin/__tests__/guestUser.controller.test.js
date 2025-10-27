const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const router = require("../guestUser.routes");

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
    });

    const res = await request(app).post("/api/users/login").send({
      email: "charlie@test.com",
      password: "password123",
      portfolioType: "photographer",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("charlie@test.com");
  });
});
