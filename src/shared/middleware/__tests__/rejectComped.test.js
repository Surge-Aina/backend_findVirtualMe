const express = require("express");
const request = require("supertest");
const rejectComped = require("../rejectComped");

describe("rejectComped middleware", () => {
  it("returns COMPED_ACCOUNT for comped users", async () => {
    const app = express();
    app.post("/billing", (req, _res, next) => {
      req.user = { comped: true };
      next();
    }, rejectComped, (_req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).post("/billing");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPED_ACCOUNT");
  });
});