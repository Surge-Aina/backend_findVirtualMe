// __tests__/exec/exec.controllers.test.js
const request = require("supertest");
const express = require("express");
const { handleExec } = require("../../exec/exec.controller");
const execService = require("../../exec/exec.service");

jest.mock("../../exec/exec.service");

const app = express();
app.use(express.json());
app.post("/exec", handleExec);

describe("Exec Controller", () => {
  test("returns ok true when service succeeds", async () => {
    execService.executeAction.mockResolvedValue({ message: "done" });
    const res = await request(app)
      .post("/exec")
      .send({ action: "contact.create", args: {} });
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toEqual({ message: "done" });
  });

  test("returns 400 for unknown action", async () => {
    const err = new Error("Unknown action");
    err.statusCode = 400;
    execService.executeAction.mockRejectedValue(err);

    const res = await request(app).post("/exec").send({ action: "invalid" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("returns 500 on internal error", async () => {
    execService.executeAction.mockRejectedValue(new Error("Something went wrong"));
    const res = await request(app).post("/exec").send({ action: "contact.create" });
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});
