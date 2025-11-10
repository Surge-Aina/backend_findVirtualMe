// tests/projects.controllers.test.js
const request = require("supertest");
const express = require("express");
const projectController = require("../../projects/projects.controllers");
const projectService = require("../../projects/projects.service");

jest.mock("../../projects/projects.service");

const app = express();
app.use(express.json());
app.get("/projects", projectController.getProjects);
app.post("/projects", projectController.addProject);
app.get("/projects/:projectId", projectController.getProjectById);
app.patch("/projects/:projectId", projectController.updateProject);
app.delete("/projects/:projectId", projectController.deleteProject);

describe("Project Controller", () => {
  test("GET /projects returns projects", async () => {
    projectService.getProjects.mockResolvedValue([{ id: "1" }]);
    const res = await request(app).get("/projects");
    expect(res.body).toEqual([{ id: "1" }]);
  });

  test("POST /projects creates project", async () => {
    projectService.addProject.mockResolvedValue({
      project: { id: "1" },
      activeProjectId: "1",
    });
    const res = await request(app).post("/projects").send({ name: "Demo" });
    expect(res.body.ok).toBe(true);
  });

  test("GET /projects/:id returns 404 if not found", async () => {
    projectService.getProjectById.mockResolvedValue(null);
    const res = await request(app).get("/projects/999");
    expect(res.status).toBe(404);
  });

  test("DELETE /projects/:id returns ok", async () => {
    projectService.deleteProject.mockResolvedValue(true);
    const res = await request(app).delete("/projects/1");
    expect(res.body.ok).toBe(true);
  });
});
