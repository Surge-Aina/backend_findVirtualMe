/**
 * Tests for vercelService.js
 * 
 * These tests mock the @vercel/sdk to test domain management operations
 */

// Mock the Vercel SDK BEFORE requiring vercelService
const mockAddProjectDomain = jest.fn();
const mockVerifyProjectDomain = jest.fn();
const mockRemoveProjectDomain = jest.fn();
const mockGetProjectDomain = jest.fn();
const mockGetDomainConfig = jest.fn();

jest.mock('@vercel/sdk', () => {
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

const vercelService = require('../../services/vercelService');

describe('vercelService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set environment variables (or use defaults from vercelService)
    process.env.VERCEL_TOKEN = 'test-token';
    process.env.VERCEL_PROJECT_ID = 'frontend-find-virtual-me'; // Match default
    process.env.VERCEL_TEAM_ID = 'test-team';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    delete process.env.VERCEL_TEAM_ID;
  });

  describe('addDomain', () => {
    it('should successfully add a domain', async () => {
      const mockResponse = {
        name: 'example.com',
        verified: false,
        verification: {
          type: 'TXT',
          domain: '_vercel',
          value: 'abc123',
        },
      };

      mockAddProjectDomain.mockResolvedValue(mockResponse);

      const result = await vercelService.addDomain('example.com', 'user123', 'portfolio456');

      expect(result).toEqual({
        success: true,
        domain: 'example.com',
        verified: false,
        verification: mockResponse.verification,
      });

      expect(mockAddProjectDomain).toHaveBeenCalledWith({
        idOrName: 'frontend-find-virtual-me',
        requestBody: {
          name: 'example.com',
        },
        teamId: 'test-team',
      });
    });

    it('should throw error when API call fails', async () => {
      const error = new Error('Domain already exists');
      mockAddProjectDomain.mockRejectedValue(error);

      await expect(
        vercelService.addDomain('example.com', 'user123', 'portfolio456')
      ).rejects.toThrow('Vercel API error: Domain already exists');

      expect(mockAddProjectDomain).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      mockAddProjectDomain.mockRejectedValue(networkError);

      await expect(
        vercelService.addDomain('example.com', 'user123', 'portfolio456')
      ).rejects.toThrow('Vercel API error: Network request failed');
    });
  });

  describe('verifyDomain', () => {
    it('should successfully verify a domain', async () => {
      const mockResponse = {
        verified: true,
        verification: null,
      };

      mockVerifyProjectDomain.mockResolvedValue(mockResponse);

      const result = await vercelService.verifyDomain('example.com');

      expect(result).toEqual({
        verified: true,
        verification: null,
      });

      expect(mockVerifyProjectDomain).toHaveBeenCalledWith({
        idOrName: 'frontend-find-virtual-me',
        domain: 'example.com',
        teamId: 'test-team',
      });
    });

    it('should return verification details when not verified', async () => {
      const mockResponse = {
        verified: false,
        verification: {
          type: 'TXT',
          name: '_vercel',
          value: 'abc123',
        },
      };

      mockVerifyProjectDomain.mockResolvedValue(mockResponse);

      const result = await vercelService.verifyDomain('example.com');

      expect(result).toEqual({
        verified: false,
        verification: mockResponse.verification,
      });

      expect(mockVerifyProjectDomain).toHaveBeenCalled();
    });

    it('should throw error when verification fails', async () => {
      const error = new Error('Domain not found in project');
      mockVerifyProjectDomain.mockRejectedValue(error);

      await expect(
        vercelService.verifyDomain('example.com')
      ).rejects.toThrow('Failed to verify domain: Domain not found in project');
    });
  });

  describe('removeDomain', () => {
    it('should successfully remove a domain', async () => {
      mockRemoveProjectDomain.mockResolvedValue(undefined);

      const result = await vercelService.removeDomain('example.com');

      expect(result).toEqual({ success: true });

      expect(mockRemoveProjectDomain).toHaveBeenCalledWith({
        idOrName: 'frontend-find-virtual-me',
        domain: 'example.com',
        teamId: 'test-team',
      });
    });

    it('should throw error when removal fails', async () => {
      const error = new Error('Domain not found');
      mockRemoveProjectDomain.mockRejectedValue(error);

      await expect(
        vercelService.removeDomain('example.com')
      ).rejects.toThrow('Failed to remove domain: Domain not found');
    });
  });

  describe('getDomainStatus', () => {
    it('should successfully get domain status', async () => {
      const mockResponse = {
        verified: true,
        verification: null,
      };

      mockGetProjectDomain.mockResolvedValue(mockResponse);

      const result = await vercelService.getDomainStatus('example.com');

      expect(result).toEqual({
        verified: true,
        verification: null,
      });

      expect(mockGetProjectDomain).toHaveBeenCalledWith({
        idOrName: 'frontend-find-virtual-me',
        domain: 'example.com',
      });
    });

    it('should throw error when status check fails', async () => {
      const error = new Error('Project not found');
      mockGetProjectDomain.mockRejectedValue(error);

      await expect(
        vercelService.getDomainStatus('example.com')
      ).rejects.toThrow('Failed to get domain status: Project not found');
    });
  });

  describe('getDomainConfig', () => {
    it('should successfully get domain config', async () => {
      const mockResponse = {
        misconfigured: false,
        configuredBy: 'vercel',
        recommendedARecords: [{ type: 'A', value: '76.76.21.21' }],
        recommendedCNAMERecords: [{ type: 'CNAME', value: 'cname.vercel-dns.com' }],
        recommendedTXTRecords: [],
      };

      mockGetDomainConfig.mockResolvedValue(mockResponse);

      const result = await vercelService.getDomainConfig('example.com');

      expect(result).toEqual({
        misconfigured: false,
        configuredBy: 'vercel',
        recommendedARecords: mockResponse.recommendedARecords,
        recommendedCNAMERecords: mockResponse.recommendedCNAMERecords,
        recommendedTXTRecords: [],
      });

      expect(mockGetDomainConfig).toHaveBeenCalledWith({
        domain: 'example.com',
        teamId: 'test-team',
      });
    });

    it('should throw error when config fetch fails', async () => {
      const error = new Error('Domain not accessible');
      mockGetDomainConfig.mockRejectedValue(error);

      await expect(
        vercelService.getDomainConfig('example.com')
      ).rejects.toThrow('Failed to get domain config: Domain not accessible');
    });
  });
});
