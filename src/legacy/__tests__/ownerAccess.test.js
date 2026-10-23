const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../shared/models/User");
const UnifiedPortfolio = require("../../modules/portfolios/models/Portfolio");
const DataScientistPortfolio = require("../data-scientist/models/DataScientistPortfolio");
const Dashboard = require("../data-scientist/models/dashboardModel");
const Testimonial = require("../data-scientist/models/testimonialModel");
const Photo = require("../photographer/models/photoModel");
const Settings = require("../photographer/models/settingsModel");
const LocalVendorPortfolio = require("../local-vendor/models/LocalVendorPortfolio");
const dataScientistRoutes = require("../data-scientist/routes/dataScientistRoutes");
const dashboardRoutes = require("../data-scientist/routes/dashboardRoute");
const testimonialRoutes = require("../data-scientist/routes/testimonialRoute");
const settingsRoutes = require("../photographer/routes/settingsRoute");
const photoRoutes = require("../photographer/routes/photoRoute");
const driveRoutes = require("../photographer/routes/driveRoute");
const vendorRoutes = require("../local-vendor/routes/localVendorRoutes");

const app = express();
app.use(express.json());
app.use("/datascience-portfolio", dataScientistRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/testimonials", testimonialRoutes);
app.use("/settings", settingsRoutes);
app.use("/photo", photoRoutes);
app.use("/drive", driveRoutes);
app.use("/vendor", vendorRoutes);

function sign(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

let seq = 0;
async function makeUser(role, email) {
  seq += 1;
  return User.create({
    email,
    username: `${role}_${seq}_${Date.now()}`,
    password: await bcrypt.hash("password123", 10),
    userKey: `key_${seq}_${Date.now()}`,
    practiceId: `practice_${seq}_${Date.now()}`,
    role,
  });
}

function auth(user) {
  return { Authorization: `Bearer ${sign(user)}` };
}

describe("portfolio owner access", () => {
  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      UnifiedPortfolio.deleteMany({}),
      DataScientistPortfolio.deleteMany({}),
      Dashboard.deleteMany({}),
      Testimonial.deleteMany({}),
      Photo.deleteMany({}),
      Settings.deleteMany({}),
      LocalVendorPortfolio.deleteMany({}),
    ]);
  });

  test("data scientist section writes allow the portfolio owner and reject everyone else", async () => {
    const owner = await makeUser("customer", `ds_owner_${Date.now()}@example.com`);
    const stranger = await makeUser("customer", `ds_stranger_${Date.now()}@example.com`);
    const admin = await makeUser("admin", `ds_admin_${Date.now()}@example.com`);
    await DataScientistPortfolio.create({
      name: "Ada",
      email: owner.email,
      skills: ["sql"],
    });

    const unauth = await request(app).post("/datascience-portfolio/skills").send({ item: "python" });
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .post("/datascience-portfolio/skills")
      .set(auth(stranger))
      .send({ item: "python" });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post("/datascience-portfolio/skills")
      .set(auth(owner))
      .send({ item: "python" });
    expect(allowed.status).toBe(200);

    const asAdmin = await request(app)
      .patch("/datascience-portfolio/update")
      .set(auth(admin))
      .send({ portfolio: { name: "Ada", email: owner.email, skills: ["sql"] } });
    expect(asAdmin.status).toBe(200);
  });

  test("the sole data scientist template owner can edit the seeded portfolio", async () => {
    const owner = await makeUser("customer", `ds_sole_${Date.now()}@example.com`);
    await UnifiedPortfolio.create({
      owner: owner._id,
      template: "dataScientist",
      title: "DS",
    });
    await DataScientistPortfolio.create({
      name: "Seed",
      email: "datascientist@example.com",
      skills: [],
    });

    const res = await request(app)
      .put("/dashboard")
      .set(auth(owner))
      .send({ chartTitle: "Owner chart" });

    expect(res.status).toBe(200);
    expect(res.body.chartTitle).toBe("Owner chart");
  });

  test("a second data scientist owner cannot edit the seeded portfolio", async () => {
    const first = await makeUser("customer", `ds_first_${Date.now()}@example.com`);
    const second = await makeUser("customer", `ds_second_${Date.now()}@example.com`);
    await UnifiedPortfolio.create({ owner: first._id, template: "dataScientist", title: "A" });
    await UnifiedPortfolio.create({ owner: second._id, template: "dataScientist", title: "B" });
    await DataScientistPortfolio.create({
      name: "Seed",
      email: "datascientist@example.com",
      skills: [],
    });

    const res = await request(app)
      .put("/dashboard")
      .set(auth(second))
      .send({ chartTitle: "Nope" });

    expect(res.status).toBe(403);
  });

  test("testimonial moderation is owner or admin", async () => {
    const owner = await makeUser("customer", `review_owner_${Date.now()}@example.com`);
    const stranger = await makeUser("customer", `review_stranger_${Date.now()}@example.com`);
    await DataScientistPortfolio.create({ name: "Ada", email: owner.email, skills: [] });
    const review = await Testimonial.create({
      name: "Guest",
      email: "guest@example.com",
      rating: 5,
      review: "Great work",
    });

    const unauth = await request(app).patch(`/testimonials/admin/${review._id}`).send({ isApproved: true });
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .patch(`/testimonials/admin/${review._id}`)
      .set(auth(stranger))
      .send({ isApproved: true });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .patch(`/testimonials/admin/${review._id}`)
      .set(auth(owner))
      .send({ isApproved: true });
    expect(allowed.status).toBe(200);
    expect(allowed.body.isApproved).toBe(true);
  });

  test("photographer settings and photos follow the owned portfolio", async () => {
    const owner = await makeUser("customer", `photo_owner_${Date.now()}@example.com`);
    const stranger = await makeUser("customer", `photo_stranger_${Date.now()}@example.com`);
    const admin = await makeUser("admin", `photo_admin_${Date.now()}@example.com`);
    const portfolio = await UnifiedPortfolio.create({
      owner: owner._id,
      template: "photographer",
      title: "Lens",
    });
    const portfolioId = String(portfolio._id);

    const unauth = await request(app)
      .put("/settings/highlightsDriveFolderId")
      .send({ value: "folder-1", portfolioId });
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .put("/settings/highlightsDriveFolderId")
      .set(auth(stranger))
      .send({ value: "folder-1", portfolioId });
    expect(forbidden.status).toBe(403);

    const saved = await request(app)
      .put("/settings/highlightsDriveFolderId")
      .set(auth(owner))
      .send({ value: "folder-1", portfolioId });
    expect(saved.status).toBe(200);
    expect(saved.body.value).toBe("folder-1");

    const created = await request(app)
      .post("/photo/highlights")
      .set(auth(owner))
      .send({ url: "https://example.com/a.jpg", portfolioId });
    expect(created.status).toBe(200);
    expect(created.body.portfolioId).toBe(portfolioId);

    const cross = await request(app)
      .put(`/photo/highlights/${created.body._id}`)
      .set(auth(stranger))
      .send({ url: "https://example.com/hacked.jpg", portfolioId: "ignored" });
    expect(cross.status).toBe(403);

    const drive = await request(app).get("/drive/admin/some-folder").set(auth(owner));
    expect(drive.status).toBe(403);
    const driveTest = await request(app).get("/drive/test/some-folder").set(auth(owner));
    expect(driveTest.status).toBe(403);

    const asAdmin = await request(app)
      .put("/settings/highlightsDriveFolderId")
      .set(auth(admin))
      .send({ value: "admin-folder", portfolioId });
    expect(asAdmin.status).toBe(200);
  });

  test("legacy default photographer settings are limited to the sole photographer owner", async () => {
    const owner = await makeUser("customer", `solo_photo_${Date.now()}@example.com`);
    await UnifiedPortfolio.create({
      owner: owner._id,
      template: "photographer",
      title: "Solo",
    });

    const ok = await request(app)
      .put("/settings/galleryDriveFolderId")
      .set(auth(owner))
      .send({ value: "folder-default", portfolioId: "default" });
    expect(ok.status).toBe(200);

    const other = await makeUser("customer", `second_photo_${Date.now()}@example.com`);
    await UnifiedPortfolio.create({
      owner: other._id,
      template: "photographer",
      title: "Second",
    });

    const denied = await request(app)
      .put("/settings/galleryDriveFolderId")
      .set(auth(owner))
      .send({ value: "folder-2", portfolioId: "default" });
    expect(denied.status).toBe(403);
  });

  test("drive status hides credential configuration from non-admins", async () => {
    const owner = await makeUser("customer", `status_owner_${Date.now()}@example.com`);
    const admin = await makeUser("admin", `status_admin_${Date.now()}@example.com`);

    const anon = await request(app).get("/drive/status");
    expect(anon.status).toBe(200);
    expect(anon.body.hasRefreshToken).toBeUndefined();
    expect(anon.body.configured).toBeUndefined();
    expect(anon.body.message).toBe("Drive status is restricted");

    const customer = await request(app).get("/drive/status").set(auth(owner));
    expect(customer.body.hasRefreshToken).toBeUndefined();
    expect(customer.body.configured).toBeUndefined();

    const asAdmin = await request(app).get("/drive/status").set(auth(admin));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveProperty("configured");
    expect(asAdmin.body).toHaveProperty("hasRefreshToken");
  });

  test("authenticated users can list only their own vendors", async () => {
    const owner = await makeUser("customer", `vendor_owner_${Date.now()}@example.com`);
    const stranger = await makeUser("customer", `vendor_stranger_${Date.now()}@example.com`);
    const admin = await makeUser("admin", `vendor_admin_${Date.now()}@example.com`);
    await LocalVendorPortfolio.create({ name: "Mine", email: owner.email });
    await LocalVendorPortfolio.create({ name: "Theirs", email: stranger.email });

    const unauth = await request(app).get("/vendor/mine");
    expect(unauth.status).toBe(401);

    const list = await request(app).get("/vendor").set(auth(owner));
    expect(list.status).toBe(403);

    const mine = await request(app).get("/vendor/mine").set(auth(owner));
    expect(mine.status).toBe(200);
    expect(mine.body.map((vendor) => vendor.name)).toEqual(["Mine"]);

    const all = await request(app).get("/vendor").set(auth(admin));
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
  });
});
