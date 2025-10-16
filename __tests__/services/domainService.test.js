/**
 * Tests for domainService.js
 * 
 * These tests cover domain registration, verification, lookup, and management
 */

// Mock dependencies FIRST
jest.mock('../../services/vercelService', () => ({
  addDomain: jest.fn(),
  verifyDomain: jest.fn(),
  removeDomain: jest.fn(),
  getDomainStatus: jest.fn(),
  getDomainConfig: jest.fn(),
}));
jest.mock('../../models/User');

const mockParseString = jest.fn();

jest.mock('xml2js', () => ({
  Parser: jest.fn(() => ({
    parseString: mockParseString,
  })),
}));

const domainService = require('../../services/domainService');
const vercelService = require('../../services/vercelService');
const User = require('../../models/User');
const fs = require('fs');
const path = require('path');

// Mock fetch globally
global.fetch = jest.fn();

describe('domainService', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseString.mockReset();
    
    // Setup mock request, response, next
    mockReq = {
      params: {},
      body: {},
      user: { id: 'user123', _id: 'user123', email: 'test@example.com' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    User.updateOne = jest.fn().mockResolvedValue({});
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    User.findOne = jest.fn();

    // Setup env vars
    process.env.NAMECHEAP_USERNAME = 'testuser';
    process.env.NAMECHEAP_API_KEY = 'testkey';
    process.env.NAMECHEAP_CLIENT_IP = '1.2.3.4';
    process.env.NAMECHEAP_URL = 'https://api.sandbox.namecheap.com/xml.response';
    process.env.USER_FIRST_NAME = 'John';
    process.env.USER_LAST_NAME = 'Doe';
    process.env.USER_ADDRESS1 = '123 Main St';
    process.env.USER_CITY = 'New York';
    process.env.USER_STATE = 'NY';
    process.env.USER_ZIP = '10001';
    process.env.USER_COUNTRY = 'US';
    process.env.USER_PHONE = '+1.1234567890';
    process.env.USER_EMAIL = 'test@example.com';
    process.env.USER_NAMESERVERS = 'ns1.example.com,ns2.example.com';
  });

  afterEach(() => {
    // Clean up
    jest.restoreAllMocks();
  });

  describe('getDomain - Namecheap check', () => {
    it('should successfully check domain availability', async () => {
      mockParseString.mockImplementation((xml, callback) => {
        callback(null, {
          ApiResponse: {
            $: { Status: 'OK' },
            CommandResponse: [
              {
                DomainCheckResult: [
                  {
                    $: {
                      Domain: 'example.com',
                      Available: 'true',
                      IsPremiumName: 'false',
                      PremiumRegistrationPrice: '0',
                      IcannFee: '0',
                    },
                  },
                ],
              },
            ],
          },
        });
      });

      const xmlResponse = fs.readFileSync(
        path.join(__dirname, '../fixtures/namecheap-check-available.xml'),
        'utf-8'
      );

      global.fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(xmlResponse),
      });

      mockReq.params.domain = 'example.com';

      await domainService.getDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          available: true,
          isPremium: false,
        })
      );
    });

    it('should handle Namecheap API error', async () => {
      mockParseString.mockImplementation((xml, callback) => {
        callback(null, {
          ApiResponse: {
            $: { Status: 'ERROR' },
            Errors: [
              {
                Error: [
                  {
                    _: 'Invalid API Key',
                    $: { Number: '2030280' },
                  },
                ],
              },
            ],
          },
        });
      });

      const xmlResponse = fs.readFileSync(
        path.join(__dirname, '../fixtures/namecheap-check-error.xml'),
        'utf-8'
      );

      global.fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(xmlResponse),
      });

      mockReq.params.domain = 'example.com';

      await domainService.getDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid API Key'),
          code: '2030280',
        })
      );
    });

    it('should return error when domain is missing', async () => {
      mockReq.params.domain = '';

      await domainService.getDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Domain is required' });
    });

    it('should handle fetch failure', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      mockReq.params.domain = 'example.com';

      await domainService.getDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Network error'),
        })
      );
    });
  });

describe('verifyDNS', () => {
    it('should successfully verify domain', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'example.com',
            status: 'pending',
            portfolioId: 'portfolio123',
          },
        ],
      };

      User.findOne.mockResolvedValue(mockUser);
      User.updateOne.mockResolvedValue({ nModified: 1 });
      vercelService.verifyDomain.mockResolvedValue({
        verified: true,
        verification: null,
      });

      mockReq.params.domain = 'example.com';

      await domainService.verifyDNS(mockReq, mockRes);

      expect(vercelService.verifyDomain).toHaveBeenCalledWith('example.com');
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: 'user123', 'domains.domain': 'example.com' },
        expect.objectContaining({
          $set: expect.objectContaining({
            'domains.$.status': 'active',
            'domains.$.dnsConfigured': true,
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Domain verified and activated',
        domain: 'example.com',
      });
    });

    it('should handle verification failure (not verified)', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'example.com',
            status: 'pending',
          },
        ],
      };

      User.findOne.mockResolvedValue(mockUser);
      vercelService.verifyDomain.mockResolvedValue({
        verified: false,
        verification: {
          type: 'TXT',
          name: '_vercel',
          value: 'abc123',
        },
      });

      mockReq.params.domain = 'example.com';

      await domainService.verifyDNS(mockReq, mockRes);

      expect(User.updateOne).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'DNS verification failed',
        details: expect.objectContaining({
          type: 'TXT',
          name: '_vercel',
          value: 'abc123',
        }),
      });
    });

    it('should return 404 when domain not found for user', async () => {
      User.findOne.mockResolvedValue(null);

      mockReq.params.domain = 'example.com';

      await domainService.verifyDNS(mockReq, mockRes);

      expect(vercelService.verifyDomain).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Domain not found' });
    });

    it('should handle domain not in user domains array', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'other.com',
            status: 'active',
          },
        ],
      };

      User.findOne.mockResolvedValue(mockUser);

      mockReq.params.domain = 'example.com';

      await domainService.verifyDNS(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Domain not found' });
    });
  });

  describe('configureCustomDomain', () => {
    it('should successfully configure custom domain', async () => {
      vercelService.addDomain.mockResolvedValue({
        success: true,
        domain: 'example.com',
        verified: false,
        verification: {
          type: 'CNAME',
          value: 'cname.vercel-dns.com',
        },
      });

      User.findByIdAndUpdate.mockResolvedValue({});

      mockReq.body = {
        domain: 'example.com',
        portfolioId: 'portfolio123',
      };

      await domainService.configureCustomDomain(mockReq, mockRes);

      expect(vercelService.addDomain).toHaveBeenCalledWith(
        'example.com',
        'user123',
        'portfolio123'
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          $push: expect.objectContaining({
            domains: expect.objectContaining({
              domain: 'example.com',
              portfolioId: 'portfolio123',
              type: 'byod',
              status: 'pending_verification',
              dnsConfigured: false,
            }),
          }),
        }),
        { new: true }
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Custom domain configured'),
          domain: 'example.com',
          status: 'pending_verification',
        })
      );
    });

    it('should return error when domain or portfolioId missing', async () => {
      mockReq.body = { domain: 'example.com' }; // missing portfolioId

      await domainService.configureCustomDomain(mockReq, mockRes);

      expect(vercelService.addDomain).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Domain and portfolioId are required',
      });
    });

    it('should handle Vercel addDomain failure', async () => {
      vercelService.addDomain.mockRejectedValue(
        new Error('Vercel API error: Domain already exists')
      );

      mockReq.body = {
        domain: 'example.com',
        portfolioId: 'portfolio123',
      };

      await domainService.configureCustomDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to add domain to Vercel',
          details: expect.stringContaining('Domain already exists'),
        })
      );

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('registerDomain', () => {
    it('should successfully register domain', async () => {
      mockParseString.mockImplementation((xml, callback) => {
        callback(null, {
          ApiResponse: {
            $: { Status: 'OK' },
            CommandResponse: [
              {
                DomainCreateResult: [
                  {
                    $: {
                      Domain: 'example.com',
                      Registered: 'true',
                    },
                  },
                ],
              },
            ],
          },
        });
      });

      const xmlResponse = fs.readFileSync(
        path.join(__dirname, '../fixtures/namecheap-register-success.xml'),
        'utf-8'
      );

      global.fetch.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(xmlResponse),
      });

      vercelService.addDomain.mockResolvedValue({
        success: true,
        verified: false,
      });

      User.findByIdAndUpdate.mockResolvedValue({});

      mockReq.body = {
        domain: 'example.com',
        portfolioId: 'portfolio123',
        plan: 'basic',
      };

      await domainService.registerDomain(mockReq, mockRes);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const payload = mockRes.json.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          message: 'Domain registration initiated',
          domain: 'example.com',
          status: 'pending_verification',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return error when required fields missing', async () => {
      mockReq.body = { domain: 'example.com' }; // missing portfolioId

      await domainService.registerDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Domain and portfolioId are required',
      });
    });

    it('should return error when registrant info missing', async () => {
      delete process.env.USER_FIRST_NAME;

      mockReq.body = {
        domain: 'example.com',
        portfolioId: 'portfolio123',
      };

      await domainService.registerDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Registrant info is required',
      });
    });
  });

  describe('lookupPortfolioByDomain', () => {
    it('should successfully lookup portfolio by domain', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'johnsmith',
        firstName: 'John',
        lastName: 'Smith',
        industry: 'project-manager',
        domains: [
          {
            domain: 'example.com',
            status: 'active',
            portfolioId: 'portfolio123',
          },
        ],
      };

      User.findOne.mockResolvedValue(mockUser);

      mockReq.params.domain = 'example.com';

      await domainService.lookupPortfolioByDomain(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        domain: 'example.com',
        portfolioId: 'portfolio123',
        portfolioPath: '/portfolios/project-manager/johnsmith/portfolio123',
        user: {
          username: 'johnsmith',
          firstName: 'John',
          lastName: 'Smith',
          industry: 'project-manager',
        },
      });
    });

    it('should return 404 when domain not found', async () => {
      User.findOne.mockResolvedValue(null);

      mockReq.params.domain = 'example.com';

      await domainService.lookupPortfolioByDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Domain not found',
        message: 'No portfolio found for this domain',
      });
    });

    it('should handle invalid domain format', async () => {
      mockReq.params.domain = '!!!';

      await domainService.lookupPortfolioByDomain(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid domain format',
        message: 'Domain contains invalid characters',
      });
    });

  });

  describe('getMyDomains', () => {
    it('should return user domains', async () => {
      mockReq.user = {
        _id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        domains: [
          {
            domain: 'example.com',
            status: 'active',
            type: 'platform',
          },
        ],
        portfolios: ['portfolio123'],
      };

      await domainService.getMyDomains(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'test@example.com',
          }),
          domains: expect.any(Array),
        })
      );
    });

    it('should return 404 when user not found', async () => {
      mockReq.user = null;

      await domainService.getMyDomains(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
    });
  });
});
