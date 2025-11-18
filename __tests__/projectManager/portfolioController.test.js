const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
//const app = require("../../../../index");
const portfolioRouter = require("../../routes/projectManager/portfolioRoute");
const app = express();
app.use(express.json());
app.use("/portfolio", portfolioRouter);

const Portfolio = require("../../models/projectManager/portfolioModel");
jest.mock("../../../../middleware/auth", () => (req, _res, next) => {
  req.user = { email: "test@example.com" };
  next();
});

let mongoServer;

jest.mock("multer", () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => next()),
    fields: jest.fn(() => (req, res, next) => next()),
  }));

  multerMock.memoryStorage = jest.fn(() => ({}));
  multerMock.diskStorage = jest.fn(() => ({}));

  return multerMock;
});

const newPortfolio = {
  firstName: "Test",
  lastName: "User",
  name: "Test User",
  industry: "Software",
  email: "test@example.com",
  phone: "123-456-7890",
  location: "Seattle",
  goal: "Become a full-stack developer",
  skills: ["Node.js", "React"],
};

const updatedPortfolio = {
  firstName: "Updated",
  lastName: "User",
  name: "Updated User",
  industry: "Software",
  email: "updated@example.com",
  phone: "123-456-7890",
  location: "Seattle",
  goal: "Become a full-stack developer",
  skills: ["Node.js", "React"],
};

//setup mongoMemoryServer in place of Atlas server
//connect mongoose to provided uri
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

describe("GET /portfolio/email/:email", () => {
  it("should return portfolio if found", async () => {
    //create portfolio in mock db
    await Portfolio.create(newPortfolio);

    //lookup portfolio we just created
    const res = await request(app).get("/portfolio/email/test@example.com");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("test@example.com");
    expect(res.body.name).toBe("Test User");
    expect(res.body.skills).toContain("Node.js");
  });

  it("should return 404 if portfolio not found", async () => {
    const res = await request(app)
      .get("/portfolio/email/test@example.com")
      .query({ email: "notfound@example.com" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("portfolio not found");
  });
});

describe("POST /portfolio/add", () => {
  it("should return 201 if portfolio was added with valid data", async () => {
    const res = await request(app)
      .post("/portfolio/add")
      .send({ portfolio: newPortfolio });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("test@example.com");
    expect(res.body.name).toBe("Test User");
  });

  it("should return 400 if portfolio is missing", async () => {
    const res = await request(app).post("/portfolio/add").send({});

    expect(res.status).toBe(400);
  });
});

describe("PATCH /portfolio/edit", () => {
  it("should return 200 and an updated portfolio", async () => {
    await Portfolio.create(newPortfolio);

    const res = await request(app)
      .patch("/portfolio/edit")
      .query({ email: "test@example.com" })
      .send({ portfolio: updatedPortfolio });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("updated@example.com");
    expect(res.body.name).toBe("Updated User");
    expect(res.body.skills).toEqual(["Node.js", "React"]);
  });

  it("should return 404 if the profile was not found", async () => {
    const res = await request(app)
      .patch("/portfolio/edit")
      .query({ email: "notfound@example.com" })
      .send({ portfolio: updatedPortfolio });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /portfolio/delete", () => {
  it("Should return 200 after deleting existing portfolio", async () => {
    await Portfolio.create(newPortfolio);

    const res = await request(app)
      .delete("/portfolio/delete")
      .query({ email: "test@example.com" });

    expect(res.status).toBe(200);
  });

  it("should return 404 if the profile was not found", async () => {
    const res = await request(app)
      .delete("/portfolio/delete")
      .query({ email: "notfound@example.com" });

    expect(res.status).toBe(404);
  });
});
