const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../shared/models/User");
const LocalVendorPortfolio = require("../local-vendor/models/LocalVendorPortfolio");
const HandymanTemplate = require("../handyman/models/HandymanTemplate");
const menuRoutes = require("../local-vendor/routes/menuRoutes");
const handymanPortfolioRoutes = require("../handyman/routes/handymanPortfolioRoutes");

const app = express();
app.use(express.json());
app.use("/menu", menuRoutes);
app.use("/api/handyman/portfolio", handymanPortfolioRoutes);

function sign(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

async function makeUser(role, email) {
  return User.create({
    email,
    username: `${role}_${Date.now()}_${Math.random()}`,
    password: await bcrypt.hash("password123", 10),
    userKey: `key_${Date.now()}_${Math.random()}`,
    practiceId: `practice_${Date.now()}_${Math.random()}`,
    role,
  });
}

describe("legacy write guards", () => {
  test("unauthenticated vendor menu write is rejected", async () => {
    const vendor = await LocalVendorPortfolio.create({
      name: "Shop",
      email: "shop@example.com",
    });

    const res = await request(app)
      .post(`/menu/${vendor._id}`)
      .send({ name: "Soup", price: 5 });

    expect(res.status).toBe(401);
  });

  test("a different user cannot write another vendor menu", async () => {
    const vendor = await LocalVendorPortfolio.create({
      name: "Shop",
      email: "shop@example.com",
    });
    const attacker = await makeUser("customer", `attacker_${Date.now()}@example.com`);

    const res = await request(app)
      .post(`/menu/${vendor._id}`)
      .set("Authorization", `Bearer ${sign(attacker)}`)
      .send({ name: "Soup", price: 5 });

    expect(res.status).toBe(403);
  });

  test("the vendor owner can create a menu item", async () => {
    const owner = await makeUser("customer", `owner_${Date.now()}@example.com`);
    const vendor = await LocalVendorPortfolio.create({
      name: "Shop",
      email: owner.email,
    });

    const res = await request(app)
      .post(`/menu/${vendor._id}`)
      .set("Authorization", `Bearer ${sign(owner)}`)
      .send({ name: "Soup", price: 5, category: "Food" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Soup");
  });

  test("unauthenticated handyman portfolio writes are rejected", async () => {
    const res = await request(app)
      .post("/api/handyman/portfolio")
      .send({ title: "Job", category: "Repair", templateId: "656f9f9f9f9f9f9f9f9f9f9f" });

    expect(res.status).toBe(401);
  });

  test("a user cannot add a portfolio item to someone else's template", async () => {
    const owner = await makeUser("customer", `handy_owner_${Date.now()}@example.com`);
    const attacker = await makeUser("customer", `handy_attacker_${Date.now()}@example.com`);
    const template = await HandymanTemplate.create({ userId: String(owner._id) });

    const res = await request(app)
      .post("/api/handyman/portfolio")
      .set("Authorization", `Bearer ${sign(attacker)}`)
      .send({
        title: "Job",
        category: "Repair",
        templateId: String(template._id),
        beforeImageUrl: "https://example.com/before.jpg",
        afterImageUrl: "https://example.com/after.jpg",
      });

    expect(res.status).toBe(403);
  });
});
