const express = require("express");
const request = require("supertest");
const promoController = require("../../promo/promo.controllers");
const promoService = require("../../promo/promo.service");

jest.mock("../../promo/promo.service");

const app = express();
app.use(express.json());
app.post("/promo", promoController.createPromo);

describe("Promo Controller", () => {
  test("should return success response", async () => {
    promoService.createPromo.mockResolvedValue({ ok: true, tweet: "Done" });

    const res = await request(app).post("/promo").send({
      projectId: "1",
      target: "frontend",
      prompt: "test",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.tweet).toBe("Done");
  });

  test("should handle 400 validation error", async () => {
    promoService.createPromo.mockRejectedValue(new Error("Invalid projectId or target"));
    const res = await request(app).post("/promo").send({});
    expect(res.status).toBe(400);
  });

  test("should handle 404 project not found", async () => {
    promoService.createPromo.mockRejectedValue(new Error("Project not found"));
    const res = await request(app)
      .post("/promo")
      .send({ projectId: "1", target: "frontend" });
    expect(res.status).toBe(404);
  });

  test("should handle OpenAI error", async () => {
    promoService.createPromo.mockRejectedValue(new Error("OpenAI error: timeout"));
    const res = await request(app)
      .post("/promo")
      .send({ projectId: "1", target: "frontend" });
    expect(res.status).toBe(502);
  });

  test("should handle generic error", async () => {
    promoService.createPromo.mockRejectedValue(new Error("Unexpected failure"));
    const res = await request(app)
      .post("/promo")
      .send({ projectId: "1", target: "frontend" });
    expect(res.status).toBe(500);
  });
});
