  /**
   * Tests for vercelService.js
   *
   * These tests mock the @vercel/sdk to test domain management operations
   */

  const mockAddProjectDomain = jest.fn();
  const mockVerifyProjectDomain = jest.fn();
  const mockRemoveProjectDomain = jest.fn();
  const mockGetProjectDomain = jest.fn();
  const mockGetDomainConfig = jest.fn();

  jest.mock("@vercel/sdk", () => {
    return {
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
    };
  });

  let vercelService;

  const ORIGINAL_ENV = {
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  };

  describe("vercelService", () => {
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeAll(() => {
      // (Optional) Silence logs from the service during tests
      try {
        consoleErrorSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});
        consoleLogSpy = jest
          .spyOn(console, "log")
          .mockImplementation(() => {});
      } catch {
        // if spyOn fails for any reason, don't break tests
      }

      // Ensure env vars are present for normal tests
      process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || "test-token";
      process.env.VERCEL_PROJECT_ID =
        process.env.VERCEL_PROJECT_ID || "frontend-find-virtual-me";
      process.env.VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "test-team";

      vercelService = require("../../services/vercelService");
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterAll(() => {
      // Restore console
      if (consoleErrorSpy) consoleErrorSpy.mockRestore();
      if (consoleLogSpy) consoleLogSpy.mockRestore();

      // Restore env vars
      if (ORIGINAL_ENV.VERCEL_TOKEN === undefined) {
        delete process.env.VERCEL_TOKEN;
      } else {
        process.env.VERCEL_TOKEN = ORIGINAL_ENV.VERCEL_TOKEN;
      }

      if (ORIGINAL_ENV.VERCEL_PROJECT_ID === undefined) {
        delete process.env.VERCEL_PROJECT_ID;
      } else {
        process.env.VERCEL_PROJECT_ID = ORIGINAL_ENV.VERCEL_PROJECT_ID;
      }

      if (ORIGINAL_ENV.VERCEL_TEAM_ID === undefined) {
        delete process.env.VERCEL_TEAM_ID;
      } else {
        process.env.VERCEL_TEAM_ID = ORIGINAL_ENV.VERCEL_TEAM_ID;
      }
    });

    // ---------------------------------------------------------------------------
    // addDomain
    // ---------------------------------------------------------------------------

    describe("addDomain", () => {
      it("should successfully add a domain", async () => {
        const mockResponse = {
          name: "example.com",
          verified: false,
          verification: {
            type: "TXT",
            domain: "_vercel",
            value: "abc123",
          },
        };

        mockAddProjectDomain.mockResolvedValue(mockResponse);

        const result = await vercelService.addDomain(
          "example.com",
          "user123",
          "portfolio456"
        );

        expect(result).toEqual({
          success: true,
          domain: "example.com",
          verified: false,
          verification: mockResponse.verification,
        });

        expect(mockAddProjectDomain).toHaveBeenCalledWith({
          idOrName: "frontend-find-virtual-me",
          requestBody: {
            name: "example.com",
          },
          teamId: "test-team",
        });
      });

      it("should throw error when API call fails", async () => {
        const error = new Error("Domain already exists");
        mockAddProjectDomain.mockRejectedValue(error);

        await expect(
          vercelService.addDomain("example.com", "user123", "portfolio456")
        ).rejects.toThrow("Vercel API error: Domain already exists");

        expect(mockAddProjectDomain).toHaveBeenCalled();
      });

      it("should handle network errors gracefully", async () => {
        const networkError = new Error("Network request failed");
        mockAddProjectDomain.mockRejectedValue(networkError);

        await expect(
          vercelService.addDomain("example.com", "user123", "portfolio456")
        ).rejects.toThrow("Vercel API error: Network request failed");
      });

      it("handles non-object errors as Unknown Vercel error", async () => {
        mockAddProjectDomain.mockRejectedValueOnce("weird string error");

        await expect(
          vercelService.addDomain("example.com", "user123", "portfolio456")
        ).rejects.toThrow("Vercel API error: Unknown Vercel error");
      });

      it("parses JSON error body from Vercel and exposes code + verification", async () => {
        const apiError = {
          statusCode: 409,
          body: JSON.stringify({
            error: {
              code: "domain_conflict",
              message: "Domain already in use",
            },
            verification: { type: "TXT", value: "xyz789" },
          }),
        };

        mockAddProjectDomain.mockRejectedValueOnce(apiError);

        let thrown;
        try {
          await vercelService.addDomain(
            "example.com",
            "user123",
            "portfolio456"
          );
        } catch (err) {
          thrown = err;
        }

        expect(thrown).toBeDefined();
        expect(thrown.message).toBe(
          "Vercel API error: Domain already in use"
        );
        expect(thrown.name).toBe("VercelAPIError");
        expect(thrown.code).toBe("domain_conflict");
        expect(thrown.statusCode).toBe(409);
        expect(thrown.verification).toEqual({
          type: "TXT",
          value: "xyz789",
        });
      });

      it("uses prefix alone when error has no details", async () => {
        const bareError = { statusCode: 500 }; // no message, no body
        mockAddProjectDomain.mockRejectedValueOnce(bareError);

        await expect(
          vercelService.addDomain("example.com", "user123", "portfolio456")
        ).rejects.toThrow("Vercel API error");
      });

      it("handles invalid JSON in error.body gracefully", async () => {
        // This is to hit the branch where JSON.parse(error.body) throws
        const badError = {
          statusCode: 500,
          body: "{this is not valid JSON",
        };

        mockAddProjectDomain.mockRejectedValueOnce(badError);

        await expect(
          vercelService.addDomain("example.com", "user123", "portfolio456")
        ).rejects.toThrow("Vercel API error");
      });
    });

    // ---------------------------------------------------------------------------
    // verifyDomain
    // ---------------------------------------------------------------------------

    describe("verifyDomain", () => {
      it("should successfully verify a domain", async () => {
        const mockResponse = {
          verified: true,
          verification: null,
        };

        mockVerifyProjectDomain.mockResolvedValue(mockResponse);

        const result = await vercelService.verifyDomain("example.com");

        expect(result).toEqual({
          verified: true,
          verification: null,
        });

        expect(mockVerifyProjectDomain).toHaveBeenCalledWith({
          idOrName: "frontend-find-virtual-me",
          domain: "example.com",
          teamId: "test-team",
        });
      });

      it("should return verification details when not verified", async () => {
        const mockResponse = {
          verified: false,
          verification: {
            type: "TXT",
            name: "_vercel",
            value: "abc123",
          },
        };

        mockVerifyProjectDomain.mockResolvedValue(mockResponse);

        const result = await vercelService.verifyDomain("example.com");

        expect(result).toEqual({
          verified: false,
          verification: mockResponse.verification,
        });

        expect(mockVerifyProjectDomain).toHaveBeenCalled();
      });

      it("should throw error when verification fails", async () => {
        const error = new Error("Domain not found in project");
        mockVerifyProjectDomain.mockRejectedValue(error);

        await expect(
          vercelService.verifyDomain("example.com")
        ).rejects.toThrow(
          "Failed to verify domain: Domain not found in project"
        );
      });

      it("uses defaultMessage alone when error has no message/body", async () => {
        const bareError = { statusCode: 500 }; // no message & no body
        mockVerifyProjectDomain.mockRejectedValueOnce(bareError);

        await expect(
          vercelService.verifyDomain("example.com")
        ).rejects.toThrow("Failed to verify domain");
      });
    });

    // ---------------------------------------------------------------------------
    // removeDomain
    // ---------------------------------------------------------------------------

    describe("removeDomain", () => {
      it("should successfully remove a domain", async () => {
        mockRemoveProjectDomain.mockResolvedValue(undefined);

        const result = await vercelService.removeDomain("example.com");

        expect(result).toEqual({ success: true });

        expect(mockRemoveProjectDomain).toHaveBeenCalledWith({
          idOrName: "frontend-find-virtual-me",
          domain: "example.com",
          teamId: "test-team",
        });
      });

      it("should throw error when removal fails", async () => {
        const error = new Error("Domain not found");
        mockRemoveProjectDomain.mockRejectedValue(error);

        await expect(
          vercelService.removeDomain("example.com")
        ).rejects.toThrow("Failed to remove domain: Domain not found");
      });
    });

    // ---------------------------------------------------------------------------
    // getDomainStatus
    // ---------------------------------------------------------------------------

    describe("getDomainStatus", () => {
      it("should successfully get domain status", async () => {
        const mockResponse = {
          verified: true,
          verification: null,
        };

        mockGetProjectDomain.mockResolvedValue(mockResponse);

        const result = await vercelService.getDomainStatus("example.com");

        expect(result).toEqual({
          verified: true,
          verification: null,
        });

        expect(mockGetProjectDomain).toHaveBeenCalledWith({
          idOrName: "frontend-find-virtual-me",
          domain: "example.com",
          teamId: "test-team",
        });
      });

      it("should throw error when status check fails", async () => {
        const error = new Error("Project not found");
        mockGetProjectDomain.mockRejectedValue(error);

        await expect(
          vercelService.getDomainStatus("example.com")
        ).rejects.toThrow("Failed to get domain status: Project not found");
      });
    });

    // ---------------------------------------------------------------------------
    // getDomainConfig
    // ---------------------------------------------------------------------------

    describe("getDomainConfig", () => {
      it("should successfully get domain config", async () => {
        const mockResponse = {
          misconfigured: false,
          configuredBy: "vercel",
          recommendedARecords: [{ type: "A", value: "76.76.21.21" }],
          recommendedCNAMERecords: [
            { type: "CNAME", value: "cname.vercel-dns.com" },
          ],
          recommendedTXTRecords: [],
        };

        mockGetDomainConfig.mockResolvedValue(mockResponse);

        const result = await vercelService.getDomainConfig("example.com");

        expect(result).toEqual({
          misconfigured: false,
          configuredBy: "vercel",
          recommendedARecords: mockResponse.recommendedARecords,
          recommendedCNAMERecords: mockResponse.recommendedCNAMERecords,
          recommendedTXTRecords: [],
        });

        expect(mockGetDomainConfig).toHaveBeenCalledWith({
          domain: "example.com",
          teamId: "test-team",
        });
      });

      it("should throw error when config fetch fails", async () => {
        const error = new Error("Domain not accessible");
        mockGetDomainConfig.mockRejectedValue(error);

        await expect(
          vercelService.getDomainConfig("example.com")
        ).rejects.toThrow(
          "Failed to get domain config: Domain not accessible"
        );
      });
    });
  });

  // -----------------------------------------------------------------------------
  // Separate block to explicitly test env validation branches
  // -----------------------------------------------------------------------------

  describe("vercelService getVercelClient env validation", () => {
    const restoreEnv = () => {
      if (ORIGINAL_ENV.VERCEL_TOKEN === undefined) {
        delete process.env.VERCEL_TOKEN;
      } else {
        process.env.VERCEL_TOKEN = ORIGINAL_ENV.VERCEL_TOKEN;
      }

      if (ORIGINAL_ENV.VERCEL_PROJECT_ID === undefined) {
        delete process.env.VERCEL_PROJECT_ID;
      } else {
        process.env.VERCEL_PROJECT_ID = ORIGINAL_ENV.VERCEL_PROJECT_ID;
      }

      if (ORIGINAL_ENV.VERCEL_TEAM_ID === undefined) {
        delete process.env.VERCEL_TEAM_ID;
      } else {
        process.env.VERCEL_TEAM_ID = ORIGINAL_ENV.VERCEL_TEAM_ID;
      }
    };

    afterEach(() => {
      jest.resetModules();
      restoreEnv();
    });

    it("wraps missing VERCEL_TOKEN error via buildVercelError", async () => {
      jest.resetModules();

      delete process.env.VERCEL_TOKEN;
      process.env.VERCEL_PROJECT_ID =
        process.env.VERCEL_PROJECT_ID || "frontend-find-virtual-me";
      process.env.VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "test-team";

      const svc = require("../../services/vercelService");

      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "Vercel API error: VERCEL_TOKEN environment variable is required"
      );
    });

    it("throws when VERCEL_PROJECT_ID is missing", async () => {
      jest.resetModules();

      process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || "test-token";
      delete process.env.VERCEL_PROJECT_ID;
      process.env.VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "test-team";

      const svc = require("../../services/vercelService");

      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "Vercel API error: VERCEL_PROJECT_ID environment variable is required"
      );
    });

    it("throws when VERCEL_TEAM_ID is missing", async () => {
      jest.resetModules();

      process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN || "test-token";
      process.env.VERCEL_PROJECT_ID =
        process.env.VERCEL_PROJECT_ID || "frontend-find-virtual-me";
      delete process.env.VERCEL_TEAM_ID;

      const svc = require("../../services/vercelService");

      await expect(svc.addDomain("example.com")).rejects.toThrow(
        "Vercel API error: VERCEL_TEAM_ID environment variable is required"
      );
    });
  });
