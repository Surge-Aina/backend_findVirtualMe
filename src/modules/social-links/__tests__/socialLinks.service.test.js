import mongoose from "mongoose";
import SocialLinks from "../socialLinks.model.js";
import { socialLinksService } from "../socialLinks.service.js";

beforeAll(async () => {
  await mongoose.connect(global.__MONGO_URI__);
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  await SocialLinks.deleteMany({});
});

describe("socialLinksService", () => {
  it("should create a new social links document if none exists", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    const links = { github: "https://github.com/test" };

    const result = await socialLinksService.updateLinks(portfolioId, links);
    expect(result.links.github).toBe("https://github.com/test");
  });

  it("should update existing social links", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    await socialLinksService.updateLinks(portfolioId, { github: "old" });

    const updated = await socialLinksService.updateLinks(portfolioId, { github: "new" });
    expect(updated.links.github).toBe("new");
  });

  it("should retrieve social links by portfolioId", async () => {
    const portfolioId = new mongoose.Types.ObjectId();
    await socialLinksService.updateLinks(portfolioId, {
      twitter: "https://twitter.com/test",
    });

    const found = await socialLinksService.getByPortfolioId(portfolioId);
    expect(found.links.twitter).toBe("https://twitter.com/test");
  });
});
