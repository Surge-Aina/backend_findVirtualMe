/**
 * Tests for vercel.service.js — aligned with current implementation (addDomain(domain) only,
 * buildVercelError used for verify/remove/status/config, not for addDomain).
 */

const mockAddProjectDomain = jest.fn();
const mockVerifyProjectDomain = jest.fn();
const mockRemoveProjectDomain = jest.fn();
const mockGetProjectDomain = jest.fn();
const mockGetDomainConfig = jest.fn();

jest.mock("@vercel/sdk", () => ({
  Vercel: jest.fn().mockImplementation(() => ({
    projects: {
      addProjectDomain: mockAddProjectDomain,
      verifyProjectDomain: mockVerifyProjectDomain,
      removeProjectDomain: mockRemoveProjectDomain,
      getProjectDomain: mockGetProjectDomain,
    },
    domains: {
      getDomainConfig: mockGetDomainConfig,
    },
  })),
}));

let vercelService;

const ORIGINAL_ENV = {
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
};

describe("vercelService", () => {
  beforeAll(() => {
    process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || "test-token";
    process.env.VERCEL_PROJECT_ID =
      process.env.VERCEL_PROJECT_ID || "frontend-find-virtual-me";
    process.env.VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "test-team";
    vercelService = require("../vercel.service");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (ORIGINAL_ENV.VERCEL_TOKEN === undefined) delete process.env.VERCEL_TOKEN;
    else process.env.VERCEL_TOKEN = ORIGINAL_ENV.VERCEL_TOKEN;
    if (ORIGINAL_ENV.VERCEL_PROJECT_ID === undefined)
      delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = ORIGINAL_ENV.VERCEL_PROJECT_ID;
    if (ORIGINAL_ENV.VERCEL_TEAM_ID === undefined)
      delete process.env.VERCEL_TEAM_ID;
    else process.env.VERCEL_TEAM_ID = ORIGINAL_ENV.VERCEL_TEAM_ID;
  });

  describe("addDomain", () => {
    it("adds apex and www and returns aggregated results", async () => {
      mockAddProjectDomain
        .mockResolvedValueOnce({
          name: "example.com",
          verified: false,
          verification: { type: "TXT", value: "abc" },
        })
        .mockResolvedValueOnce({
          name: "www.example.com",
          verified: false,
          verification: [],
        });

      const result = await vercelService.addDomain("example.com");

      expect(mockAddProjectDomain).toHaveBeenCalledTimes(2);
      expect(mockAddProjectDomain).toHaveBeenNthCalledWith(1, {
        idOrName: "frontend-find-virtual-me",
        requestBody: { name: "example.com" },
        teamId: "test-team",
      });
      expect(mockAddProjectDomain).toHaveBeenNthCalledWith(2, {
        idOrName: "frontend-find-virtual-me",
        requestBody: { name: "www.example.com" },
        teamId: "test-team",
      });

      expect(result.domains).toHaveLength(2);
      expect(result.verified).toBe(false);
      expect(Array.isArray(result.verification)).toBe(true);
    });

    it("propagates API errors as thrown (not wrapped)", async () => {
      mockAddProjectDomain.mockRejectedValue(new Error("Domain already exists"));

      await expect(vercelService.addDomain("example.com")).rejects.toThrow(
        "Domain already exists"
      );
    });

    it("skips when domain_already_exists and continues", async () => {
      mockAddProjectDomain
        .mockRejectedValueOnce(Object.assign(new Error("exists"), { code: "domain_already_exists" }))
        .mockResolvedValueOnce({
          name: "www.example.com",
          verified: true,
          verification: [],
        });

      const result = await vercelService.addDomain("example.com");
      expect(result.domains.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("verifyDomain", () => {
    it("returns verification payload", async () => {
      mockVerifyProjectDomain.mockResolvedValue({
        verified: true,
        verification: null,
      });

      const result = await vercelService.verifyDomain("example.com");
      expect(result).toEqual({ verified: true, verification: null });
      expect(mockVerifyProjectDomain).toHaveBeenCalledWith({
        idOrName: "frontend-find-virtual-me",
        domain: "example.com",
        teamId: "test-team",
      });
    });

    it("wraps failures with buildVercelError defaultMessage", async () => {
      mockVerifyProjectDomain.mockRejectedValue(
        new Error("Domain not found in project")
      );

      await expect(
        vercelService.verifyDomain("example.com")
      ).rejects.toThrow("Failed to verify domain: Domain not found in project");
    });
  });

  describe("removeDomain", () => {
    it("returns success", async () => {
      mockRemoveProjectDomain.mockResolvedValue(undefined);
      const result = await vercelService.removeDomain("example.com");
      expect(result).toEqual({ success: true });
    });

    it("wraps removal errors", async () => {
      mockRemoveProjectDomain.mockRejectedValue(new Error("Domain not found"));
      await expect(
        vercelService.removeDomain("example.com")
      ).rejects.toThrow("Failed to remove domain: Domain not found");
    });
  });

  describe("getDomainStatus", () => {
    it("returns status fields", async () => {
      mockGetProjectDomain.mockResolvedValue({
        verified: true,
        verification: null,
      });
      const result = await vercelService.getDomainStatus("example.com");
      expect(result).toEqual({ verified: true, verification: null });
    });

    it("wraps errors", async () => {
      mockGetProjectDomain.mockRejectedValue(new Error("Project not found"));
      await expect(
        vercelService.getDomainStatus("example.com")
      ).rejects.toThrow("Failed to get domain status: Project not found");
    });
  });

  describe("getDomainConfig", () => {
    it("returns DNS hints", async () => {
      mockGetDomainConfig.mockResolvedValue({
        misconfigured: false,
        configuredBy: "vercel",
        recommendedARecords: [],
        recommendedCNAMERecords: [],
        recommendedTXTRecords: [],
      });
      const result = await vercelService.getDomainConfig("example.com");
      expect(result.misconfigured).toBe(false);
    });

    it("wraps errors", async () => {
      mockGetDomainConfig.mockRejectedValue(new Error("Domain not accessible"));
      await expect(
        vercelService.getDomainConfig("example.com")
      ).rejects.toThrow("Failed to get domain config: Domain not accessible");
    });
  });

  describe("env validation (addDomain)", () => {
    const restore = () => {
      process.env.VERCEL_TOKEN = ORIGINAL_ENV.VERCEL_TOKEN ?? "test-token";
      process.env.VERCEL_PROJECT_ID =
        ORIGINAL_ENV.VERCEL_PROJECT_ID ?? "frontend-find-virtual-me";
      process.env.VERCEL_TEAM_ID = ORIGINAL_ENV.VERCEL_TEAM_ID ?? "test-team";
    };

    afterEach(() => {
      jest.resetModules();
      restore();
    });

    it("throws when VERCEL_PROJECT_ID is missing", async () => {
      jest.resetModules();
      process.env.VERCEL_TOKEN = "test-token";
      delete process.env.VERCEL_PROJECT_ID;
      process.env.VERCEL_TEAM_ID = "test-team";
      const svc = require("../vercel.service");
      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "VERCEL_PROJECT_ID environment variable is required"
      );
    });

    it("throws when VERCEL_TEAM_ID is missing", async () => {
      jest.resetModules();
      process.env.VERCEL_TOKEN = "test-token";
      process.env.VERCEL_PROJECT_ID = "frontend-find-virtual-me";
      delete process.env.VERCEL_TEAM_ID;
      const svc = require("../vercel.service");
      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "VERCEL_TEAM_ID environment variable is required"
      );
    });

    it("throws when VERCEL_TOKEN is missing (after project/team pass)", async () => {
      jest.resetModules();
      delete process.env.VERCEL_TOKEN;
      process.env.VERCEL_PROJECT_ID = "frontend-find-virtual-me";
      process.env.VERCEL_TEAM_ID = "test-team";
      const svc = require("../vercel.service");
      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "VERCEL_TOKEN environment variable is required"
      );
    });
  });
});
