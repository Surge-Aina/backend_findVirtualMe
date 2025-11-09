const express = require("express");
const request = require("supertest");
const nameController = require("../../name/name.controllers");
const nameService = require("../../name/name.service");

jest.mock("../../name/name.service");

const app = express();
app.use(express.json());
app.get("/name", nameController.getName);
app.post("/name", nameController.updateName);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Name Controller", () => {
  test("GET /name should return name", async () => {
    nameService.getName.mockResolvedValue("Charlie");

    const res = await request(app).get("/name");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Charlie" });
  });

  test("POST /name should update name", async () => {
    nameService.updateName.mockResolvedValue("Updated Name");

    const res = await request(app).post("/name").send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Updated Name" });
  });

  test("POST /name should return 404 if no active project", async () => {
    nameService.updateName.mockRejectedValue(new Error("No active project"));

    const res = await request(app).post("/name").send({ name: "Fail" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "No active project" });
  });

  test("should return 500 if service throws unexpected error", async () => {
    nameService.getName.mockRejectedValue(new Error("DB crash"));

    const res = await request(app).get("/name");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "DB crash" });
  });
});
