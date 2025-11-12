const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

jest.mock("fs/promises");
jest.mock("fs");

const contactService = require("../../contact/aiPortfolioCreator.service");

describe("Contact Service", () => {
  const sampleContact = { email: "a@b.com", message: "Hello" };
  const sampleEntry = {
    id: "ct_123",
    userName: "Alice",
    projectId: "default",
    time: new Date().toISOString(),
    contact: sampleContact,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sanitizeContact", () => {
    test("removes invalid fields and limits to maxFields", () => {
      const input = { a: "1", b: 2, c: true, d: {}, e: [] };
      const result = contactService.sanitizeContact(input, 3);
      expect(result).toEqual({ a: "1", b: 2, c: true });
    });

    test("returns null for non-object input", () => {
      expect(contactService.sanitizeContact(null)).toBeNull();
      expect(contactService.sanitizeContact("string")).toBeNull();
      expect(contactService.sanitizeContact([])).toBeNull();
    });

    test("trims string values to 1000 chars", () => {
      const long = "a".repeat(2000);
      const result = contactService.sanitizeContact({ text: long });
      expect(result.text.length).toBe(1000);
    });
  });

  describe("createContact", () => {
    test("throws if userName or contact missing", async () => {
      await expect(contactService.createContact({})).rejects.toThrow(
        "userName and contact required"
      );
    });

    test("creates and writes a new contact", async () => {
      fsp.readFile.mockResolvedValue("[]");
      fsp.writeFile.mockResolvedValue();
      fsp.access.mockResolvedValue();

      const entry = await contactService.createContact({
        userName: "Alice",
        contact: sampleContact,
      });

      expect(entry.userName).toBe("Alice");
      expect(entry.contact).toEqual(sampleContact);
      expect(fsp.writeFile).toHaveBeenCalledTimes(2); // contacts + last submitter
    });
  });

  describe("updateContact", () => {
    test("throws if id missing or not found", async () => {
      fsp.readFile.mockResolvedValue("[]");
      fsp.access.mockResolvedValue();

      await expect(contactService.updateContact()).rejects.toThrow("id required");
      await expect(contactService.updateContact("nonexistent")).rejects.toThrow(
        "Not found"
      );
    });

    test("updates contact and calls write", async () => {
      const list = [sampleEntry];
      fsp.readFile.mockResolvedValue(JSON.stringify(list));
      fsp.writeFile.mockResolvedValue();
      fsp.access.mockResolvedValue();

      const updated = await contactService.updateContact(sampleEntry.id, {
        userName: "Bob",
        contact: { message: "Updated" },
      });

      expect(updated.userName).toBe("Bob");
      expect(updated.contact.message).toBe("Updated");
      expect(fsp.writeFile).toHaveBeenCalled();
    });
  });

  describe("bulkUpdate", () => {
    test("throws if input invalid", async () => {
      await expect(contactService.bulkUpdate()).rejects.toThrow(
        "Array of updates required"
      );
      await expect(contactService.bulkUpdate([])).rejects.toThrow(
        "Array of updates required"
      );
    });

    test("applies multiple updates", async () => {
      const list = [sampleEntry];
      fsp.readFile.mockResolvedValue(JSON.stringify(list));
      fsp.writeFile.mockResolvedValue();
      fsp.access.mockResolvedValue();

      const result = await contactService.bulkUpdate([
        { id: sampleEntry.id, contact: { message: "Bulk" } },
      ]);

      expect(result[0].contact.message).toBe("Bulk");
      expect(fsp.writeFile).toHaveBeenCalled();
    });
  });

  describe("ensureContact", () => {
    test("returns existing contact if found", async () => {
      fsp.readFile.mockResolvedValue(JSON.stringify([sampleEntry]));
      fsp.access.mockResolvedValue();

      const found = await contactService.ensureContact({
        userName: "Alice",
        projectId: "default",
      });

      expect(found.id).toBe(sampleEntry.id);
    });

    test("creates stub if not found", async () => {
      fsp.readFile.mockResolvedValue("[]");
      fsp.writeFile.mockResolvedValue();
      fsp.access.mockResolvedValue();

      const stub = await contactService.ensureContact({ userName: "Bob" });
      expect(stub.userName).toBe("Bob");
      expect(stub.contact).toEqual({ email: "", message: "" });
    });

    test("throws if userName missing", async () => {
      await expect(contactService.ensureContact({})).rejects.toThrow("userName required");
    });
  });

  describe("readContacts/writeContacts/setLastSubmitter", () => {
    test("readContacts returns parsed list", async () => {
      fsp.readFile.mockResolvedValue(JSON.stringify([sampleEntry]));
      fsp.access.mockResolvedValue();
      const list = await contactService.readContacts();
      expect(list.length).toBe(1);
      expect(list[0].userName).toBe("Alice");
    });

    test("writeContacts calls writeFile", async () => {
      fsp.writeFile.mockResolvedValue();
      await contactService.writeContacts([sampleEntry]);
      expect(fsp.writeFile).toHaveBeenCalled();
    });

    test("setLastSubmitter writes data file", async () => {
      fsp.writeFile.mockResolvedValue();
      fsp.access.mockResolvedValue();
      await contactService.setLastSubmitter("Alice");
      expect(fsp.writeFile).toHaveBeenCalled();
    });
  });
});
