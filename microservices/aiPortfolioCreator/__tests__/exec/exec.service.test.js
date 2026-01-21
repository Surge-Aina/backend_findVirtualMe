// __tests__/exec/exec.service.test.js
const execService = require("../../exec/exec.service");
const contactSvc = require("../../contact/aiPortfolioCreator.service");

jest.mock("../../contact/aiPortfolioCreator.service", () => ({
  createContact: jest.fn(),
  updateContact: jest.fn(),
  ensureContact: jest.fn(),
  listContacts: jest.fn(),
}));

describe("Exec Service", () => {
  test("calls createContact for contact.create", async () => {
    await execService.executeAction("contact.create", { name: "A" });
    expect(contactSvc.createContact).toHaveBeenCalledWith({ name: "A" });
  });

  test("throws error for unknown action", async () => {
    await expect(execService.executeAction("invalid.action")).rejects.toThrow(
      "Unknown action"
    );
  });

  test("calls updateContact with id", async () => {
    await execService.executeAction("contact.update", { id: "123", name: "A" });
    expect(contactSvc.updateContact).toHaveBeenCalledWith("123", {
      id: "123",
      name: "A",
    });
  });
});
