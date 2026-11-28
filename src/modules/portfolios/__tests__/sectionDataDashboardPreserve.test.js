const mongoose = require("mongoose");
const User = require("../../../shared/models/User");
const Portfolio = require("../models/Portfolio");
const portfolioService = require("../portfolio.service");

const OWNER_ID = new mongoose.Types.ObjectId();

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 8)}`;
}

describe("dashboard validateSectionData preservation", () => {
  beforeEach(async () => {
    await User.findOneAndUpdate(
      { _id: OWNER_ID },
      {
        username: `dash_${nonce()}`,
        email: `dash.${nonce()}@example.test`,
        password: "synthetic-password",
        userKey: `uk_${nonce()}`,
        practiceId: `pid_${nonce()}`,
        role: "customer",
        name: "Dashboard Owner",
      },
      { upsert: true, new: true }
    );
  });

  it("keeps 10k-char strings through validateSectionData and updateSection", async () => {
    const longText = "z".repeat(10_000);
    const validated = portfolioService.validateSectionData("hero", {
      description: longText,
      practiceName: "Clinic",
    });
    expect(validated.description).toHaveLength(10_000);

    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "healthcare");
    const hero = portfolio.sections.find((s) => s.type === "hero");
    await portfolioService.updateSection(portfolio._id, hero._id, {
      ...hero.data,
      description: longText,
    });

    const reloaded = await Portfolio.findById(portfolio._id).lean();
    const reloadedHero = reloaded.sections.find((s) => String(s._id) === String(hero._id));
    expect(reloadedHero.data.description).toHaveLength(10_000);
  });

  it("keeps 150 gallery items through updateSection", async () => {
    const images = Array.from({ length: 150 }, (_, index) => ({
      url: `https://cdn.example.test/${index}.jpg`,
      caption: `Image ${index}`,
    }));
    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "healthcare");
    const gallery = portfolio.sections.find((s) => s.type === "gallery");
    await portfolioService.updateSection(portfolio._id, gallery._id, {
      ...gallery.data,
      facilityImages: images,
    });

    const reloaded = await Portfolio.findById(portfolio._id).lean();
    const reloadedGallery = reloaded.sections.find((s) => String(s._id) === String(gallery._id));
    expect(reloadedGallery.data.facilityImages).toHaveLength(150);
  });

  it("preserves explicit null fields on dashboard save", async () => {
    const validated = portfolioService.validateSectionData("contact", {
      email: null,
      phone: "555-0100",
    });
    expect(validated.email).toBeNull();

    const portfolio = await portfolioService.createPortfolio(OWNER_ID, "projectManager");
    const contact = portfolio.sections.find((s) => s.type === "contact");
    await portfolioService.updateSection(portfolio._id, contact._id, {
      ...contact.data,
      email: null,
    });

    const reloaded = await Portfolio.findById(portfolio._id).lean();
    const reloadedContact = reloaded.sections.find((s) => String(s._id) === String(contact._id));
    expect(reloadedContact.data.email).toBeNull();
  });
});