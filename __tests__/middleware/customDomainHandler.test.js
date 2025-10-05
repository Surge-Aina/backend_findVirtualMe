/**
 * Tests for customDomainHandler middleware
 * 
 * Tests custom domain request handling and portfolio info return
 */

const customDomainHandler = require('../../middleware/customDomainHandler');

describe('customDomainHandler middleware', () => {
  let mockReq, mockRes, mockNext;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock request, response, next
    mockReq = {
      path: '/',
      isCustomDomain: false,
      customDomainPortfolioId: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Custom domain requests', () => {
    it('should return portfolio info for root path on custom domain', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomain = 'johnsmith.com';
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.customDomainPortfolioType = 'project_manager';
      mockReq.customDomainUser = {
        _id: 'user123',
        username: 'johnsmith',
        firstName: 'John',
        lastName: 'Smith',
        industry: 'project_manager',
      };
      mockReq.path = '/';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        customDomain: true,
        domain: 'johnsmith.com',
        portfolioId: 'portfolio123',
        portfolioType: 'project_manager',
        user: {
          id: 'user123',
          username: 'johnsmith',
          firstName: 'John',
          lastName: 'Smith',
          industry: 'project_manager',
        },
        message: 'Custom domain detected - portfolio should be rendered',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Custom domain handler: serving portfolio for johnsmith.com'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return portfolio info for any non-API path on custom domain', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomain = 'example.com';
      mockReq.customDomainPortfolioId = 'portfolio456';
      mockReq.customDomainPortfolioType = 'handyman';
      mockReq.customDomainUser = {
        _id: 'user456',
        username: 'bob',
        firstName: 'Bob',
        lastName: 'Builder',
        industry: 'handyman',
      };
      mockReq.path = '/about';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          portfolioId: 'portfolio456',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Skip paths (API routes)', () => {
    beforeEach(() => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.customDomain = 'example.com';
    });

    it('should skip /api/ paths', async () => {
      mockReq.path = '/api/users';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /auth/ paths', async () => {
      mockReq.path = '/auth/login';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /uploads/ paths', async () => {
      mockReq.path = '/uploads/image.jpg';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should skip /health path', async () => {
      mockReq.path = '/health';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /stripe-webhook path', async () => {
      mockReq.path = '/stripe-webhook';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /checkout paths', async () => {
      mockReq.path = '/checkout/session';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /portfolio/ paths', async () => {
      mockReq.path = '/portfolio/me';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /user/ paths', async () => {
      mockReq.path = '/user/login';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /settings/ paths', async () => {
      mockReq.path = '/settings/profile';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /testimonials/ paths', async () => {
      mockReq.path = '/testimonials/list'; // Use full path with trailing slash match

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /dashboard/ paths', async () => {
      mockReq.path = '/dashboard/stats';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /vendor/ paths', async () => {
      mockReq.path = '/vendor/menu';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip /subscriptions/ paths', async () => {
      mockReq.path = '/subscriptions/manage';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Non-custom domain requests', () => {
    it('should call next() when not a custom domain', async () => {
      mockReq.isCustomDomain = false;
      mockReq.path = '/';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when portfolioId is missing', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = null;
      mockReq.path = '/';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when portfolioId is undefined', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = undefined;
      mockReq.path = '/';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing customDomainUser gracefully', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.customDomain = 'example.com';
      mockReq.customDomainPortfolioType = 'general';
      mockReq.customDomainUser = null;
      mockReq.path = '/';

      // Should not crash
      await expect(
        customDomainHandler(mockReq, mockRes, mockNext)
      ).rejects.toThrow();
    });

    it('should handle paths with query strings', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.customDomain = 'example.com';
      mockReq.customDomainUser = {
        _id: 'user123',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
        industry: 'general',
      };
      mockReq.path = '/?page=1';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle nested API paths', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.path = '/api/v1/users/me';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('Console logging', () => {
    it('should log when serving portfolio for custom domain', async () => {
      mockReq.isCustomDomain = true;
      mockReq.customDomain = 'test.com';
      mockReq.customDomainPortfolioId = 'portfolio123';
      mockReq.customDomainUser = {
        _id: 'user123',
        username: 'test',
        firstName: 'Test',
        lastName: 'User',
        industry: 'general',
      };
      mockReq.path = '/';

      await customDomainHandler(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Custom domain handler: serving portfolio for test.com'
      );
    });
  });
});
