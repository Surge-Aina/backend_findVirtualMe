const express = require("express");
const request = require("supertest");
const httpErrorHandler = require("../httpErrorHandler");

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.post("/echo", (req, res) => res.json(req.body));
  app.use(httpErrorHandler);
  return app;
}

describe("httpErrorHandler", () => {
  it("returns 400 for malformed JSON", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bad_request");
  });

  it("returns 413 for payloads over 1mb", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ blob: "x".repeat(1_100_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
  });

  it("maps only CORS errors to 403", async () => {
    const app = express();
    app.get("/cors", (_req, res, next) => next(new Error("Not allowed by CORS")));
    app.get("/explicit", (_req, res, next) => {
      const err = new Error("token expired");
      err.status = 401;
      next(err);
    });
    app.use(httpErrorHandler);

    const cors = await request(app).get("/cors");
    expect(cors.status).toBe(403);
    expect(cors.body.error.code).toBe("origin_not_allowed");

    const explicit = await request(app).get("/explicit");
    expect(explicit.status).toBe(401);
    expect(explicit.body.error.code).toBe("request_error");
  });
});