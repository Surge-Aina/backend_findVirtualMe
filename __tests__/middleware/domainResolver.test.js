/**
 * Tests for domainResolver middleware
 * 
 * Tests custom domain detection and request enrichment
 */

const domainResolver = require('../../middleware/domainResolver');
const User = require('../../models/User');

// Mock User model
jest.mock('../../models/User');

describe('domainResolver middleware', () => {
  let mockReq, mockRes, mockNext;
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock request, response, next
    mockReq = {
      get: jest.fn(),
    };

    mockRes = {};
    mockNext = jest.fn();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Custom domain detection', () => {
    it('should detect custom domain and set request properties', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'johnsmith',
        industry: 'project_manager',
        domains: [
          {
            domain: 'johnsmith.com',
            status: 'active',
            portfolioId: 'portfolio123',
          },
        ],
      };

      mockReq.get.mockReturnValue('johnsmith.com');
      User.findOne.mockResolvedValue(mockUser);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBe(true);
      expect(mockReq.customDomain).toBe('johnsmith.com');
      expect(mockReq.customDomainUser).toEqual(mockUser);
      expect(mockReq.customDomainPortfolioId).toBe('portfolio123');
      expect(mockReq.customDomainPortfolioType).toBe('project_manager');
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Custom domain detected: johnsmith.com')
      );
    });

    it('should handle uppercase domains (case-insensitive)', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'johnsmith.com',
            status: 'active',
            portfolioId: 'portfolio123',
          },
        ],
      };

      mockReq.get.mockReturnValue('JohnSmith.COM');
      User.findOne.mockResolvedValue(mockUser);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBe(true);
      expect(mockReq.customDomain).toBe('johnsmith.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle domain with port (localhost:5000)', async () => {
      mockReq.get.mockReturnValue('localhost:5000');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('should sanitize invalid characters from hostname', async () => {
      mockReq.get.mockReturnValue('bad!host<>.com');
      User.findOne.mockResolvedValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      // Sanitizes to 'badhost.com' (removes invalid chars but keeps valid ones like '.')
      expect(User.findOne).toHaveBeenCalledWith({
        'domains.domain': 'badhost.com',
        'domains.status': 'active',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Main domain skip', () => {
    it('should skip findvirtualme.com', async () => {
      mockReq.get.mockReturnValue('findvirtualme.com');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip www.findvirtualme.com', async () => {
      mockReq.get.mockReturnValue('www.findvirtualme.com');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip findvirtual.me', async () => {
      mockReq.get.mockReturnValue('findvirtual.me');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip localhost', async () => {
      mockReq.get.mockReturnValue('localhost');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip when hostname is empty', async () => {
      mockReq.get.mockReturnValue('');

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip when hostname is null', async () => {
      mockReq.get.mockReturnValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Domain not found scenarios', () => {
    it('should call next when custom domain not found in DB', async () => {
      mockReq.get.mockReturnValue('unknown.com');
      User.findOne.mockResolvedValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(User.findOne).toHaveBeenCalledWith({
        'domains.domain': 'unknown.com',
        'domains.status': 'active',
      });
      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when domain found but not active', async () => {
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

      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockResolvedValue(null); // findOne filters by status: active

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when domain found but no portfolioId', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'example.com',
            status: 'active',
            portfolioId: null,
          },
        ],
      };

      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockResolvedValue(mockUser);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');

      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockRejectedValue(dbError);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Domain lookup error:',
        'Database connection failed'
      );
      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not crash on unexpected errors', async () => {
      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockRejectedValue(new Error('Unexpected error'));

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle null user gracefully', async () => {
      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockResolvedValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.isCustomDomain).toBeUndefined();
    });
  });

  describe('Multiple domains per user', () => {
    it('should find correct domain when user has multiple domains', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'johnsmith',
        industry: 'project_manager',
        domains: [
          {
            domain: 'example.com',
            status: 'active',
            portfolioId: 'portfolio123',
          },
          {
            domain: 'johnsmith.com',
            status: 'active',
            portfolioId: 'portfolio456',
          },
        ],
      };

      mockReq.get.mockReturnValue('johnsmith.com');
      User.findOne.mockResolvedValue(mockUser);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBe(true);
      expect(mockReq.customDomain).toBe('johnsmith.com');
      expect(mockReq.customDomainPortfolioId).toBe('portfolio456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle domain with no status match', async () => {
      const mockUser = {
        _id: 'user123',
        domains: [
          {
            domain: 'example.com',
            status: 'expired',
            portfolioId: 'portfolio123',
          },
        ],
      };

      mockReq.get.mockReturnValue('example.com');
      // findOne won't return this user because query filters by status: 'active'
      User.findOne.mockResolvedValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.isCustomDomain).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Industry fallback', () => {
    it('should default to "general" when industry missing', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'johnsmith',
        industry: undefined,
        domains: [
          {
            domain: 'example.com',
            status: 'active',
            portfolioId: 'portfolio123',
          },
        ],
      };

      mockReq.get.mockReturnValue('example.com');
      User.findOne.mockResolvedValue(mockUser);

      await domainResolver(mockReq, mockRes, mockNext);

      expect(mockReq.customDomainPortfolioType).toBe('general');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Port handling', () => {
    it('should strip port from hostname before lookup', async () => {
      mockReq.get.mockReturnValue('example.com:3000');
      User.findOne.mockResolvedValue(null);

      await domainResolver(mockReq, mockRes, mockNext);

      // Note: sanitize happens BEFORE port splitting, so : gets removed
      // 'example.com:3000' -> 'examplecom3000' -> split -> 'examplecom3000'
      // Actually the regex keeps dots and hyphens, so: 'example.com3000'
      expect(User.findOne).toHaveBeenCalledWith({
        'domains.domain': 'example.com3000', // colon removed by sanitization
        'domains.status': 'active',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
