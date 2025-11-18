const { setupTestDB, teardownTestDB, clearTestDB } = require('../setup.js');
const User = require('../../../models/User.js');
const mongoose = require('mongoose');

describe('Domain Service - Database Operations', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('User Domain Management', () => {
    test("should add domain to user via database operation", async () => {
      const testUser = await User.create({
        email: "test@example.com",
        username: "testuser",
        password: "hashedpassword123",
        portfolios: ["portfolio123"],
      });

      // Simulate domain registration database update
      const updatedUser = await User.findByIdAndUpdate(
        testUser._id,
        {
          $push: {
            domains: {
              domain: "testdomain.com",
              portfolioId: "portfolio123",
              type: "platform",
              status: "active",
              registeredAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              dnsConfigured: true,
              // SSL automatically handled by Vercel
            },
          },
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe("testdomain.com");
      expect(updatedUser.domains[0].portfolioId).toBe("portfolio123");
      expect(updatedUser.domains[0].type).toBe("platform");
      expect(updatedUser.domains[0].status).toBe("active");
    });

    test("should add BYOD domain to user", async () => {
      const testUser = await User.create({
        email: "byod@example.com",
        username: "byoduser",
        password: "hashedpassword123",
        portfolios: ["portfolio456"],
      });

      // Simulate BYOD configuration database update
      const updatedUser = await User.findByIdAndUpdate(
        testUser._id,
        {
          $push: {
            domains: {
              domain: "mycustom.com",
              portfolioId: "portfolio456",
              type: "byod",
              status: "pending",
              registeredAt: new Date(),
              dnsConfigured: false,
              // SSL automatically handled by Vercel
            },
          },
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe("mycustom.com");
      expect(updatedUser.domains[0].portfolioId).toBe("portfolio456");
      expect(updatedUser.domains[0].type).toBe("byod");
      expect(updatedUser.domains[0].status).toBe("pending");
      expect(updatedUser.domains[0].dnsConfigured).toBe(false);
      // No need to test sslIssued - Vercel handles SSL automatically
    });

    test("should find user by domain", async () => {
      const testUser = await User.create({
        email: "finddomain@example.com",
        username: "finddomainuser",
        password: "hashedpassword123",
        domains: [
          {
            domain: "findme.com",
            portfolioId: "portfolio789",
            type: "platform",
            status: "active",
          },
        ],
      });

      // Find user by domain
      const foundUser = await User.findOne({
        "domains.domain": "findme.com",
        "domains.status": "active",
      });

      expect(foundUser).toBeTruthy();
      expect(foundUser.email).toBe("finddomain@example.com");
      expect(foundUser.domains[0].domain).toBe("findme.com");
    });

    test("should update domain status", async () => {
      const testUser = await User.create({
        email: "updatestatus@example.com",
        username: "updatestatususer",
        password: "hashedpassword123",
        domains: [
          {
            domain: "updateme.com",
            portfolioId: "portfolio123",
            type: "byod",
            status: "pending",
            dnsConfigured: false,
            // SSL automatically handled by Vercel
          },
        ],
      });

      // Update domain status (simulate DNS verification)
      const updatedUser = await User.findOneAndUpdate(
        { _id: testUser._id, "domains.domain": "updateme.com" },
        {
          $set: {
            "domains.$.status": "active",
            "domains.$.dnsConfigured": true,
            // SSL automatically handled by Vercel
          },
        },
        { new: true }
      );

      const domain = updatedUser.domains[0];
      expect(domain.status).toBe("active");
      expect(domain.dnsConfigured).toBe(true);
      // No need to test sslIssued - Vercel handles SSL automatically
    });

    test('should retrieve user domains and portfolios', async () => {
      const testUser = await User.create({
        email: 'getdomains@example.com',
        username: 'getdomainsuser',
        password: 'hashedpassword123',
        portfolios: ['portfolio1', 'portfolio2'],
        domains: [
          {
            domain: 'domain1.com',
            portfolioId: 'portfolio1',
            type: 'platform',
            status: 'active'
          },
          {
            domain: 'domain2.com',
            portfolioId: 'portfolio2',
            type: 'byod',
            status: 'pending'
          }
        ]
      });

      // Retrieve user with domains and portfolios
      const userWithDomains = await User.findById(testUser._id).select('domains portfolios');

      expect(userWithDomains.domains).toHaveLength(2);
      expect(userWithDomains.portfolios).toHaveLength(2);
      expect(userWithDomains.domains[0].domain).toBe('domain1.com');
      expect(userWithDomains.domains[1].domain).toBe('domain2.com');
    });

    test('should remove domain from user', async () => {
      const testUser = await User.create({
        email: 'removedomain@example.com',
        username: 'removedomainuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'keepme.com',
            portfolioId: 'portfolio1'
          },
          {
            domain: 'deleteme.com',
            portfolioId: 'portfolio2'
          }
        ]
      });

      // Remove specific domain
      const updatedUser = await User.findByIdAndUpdate(
        testUser._id,
        {
          $pull: {
            domains: { domain: 'deleteme.com' }
          }
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe('keepme.com');
    });

    test('should handle multiple domains for same portfolio', async () => {
      const testUser = await User.create({
        email: 'multidomains@example.com',
        username: 'multidomainsuser',
        password: 'hashedpassword123',
        portfolios: ['portfolio1'],
        domains: [
          {
            domain: 'main.com',
            portfolioId: 'portfolio1',
            type: 'platform',
            status: 'active'
          },
          {
            domain: 'www.main.com',
            portfolioId: 'portfolio1',
            type: 'byod',
            status: 'active'
          }
        ]
      });

      // Find all domains for a specific portfolio
      const userWithPortfolio = await User.findOne({
        'domains.portfolioId': 'portfolio1'
      });

      const portfolio1Domains = userWithPortfolio.domains.filter(
        d => d.portfolioId === 'portfolio1'
      );

      expect(portfolio1Domains).toHaveLength(2);
      expect(portfolio1Domains.map(d => d.domain)).toContain('main.com');
      expect(portfolio1Domains.map(d => d.domain)).toContain('www.main.com');
    });

    test('should handle domain expiration updates', async () => {
      const testUser = await User.create({
        email: 'expiration@example.com',
        username: 'expirationuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'expires.com',
            portfolioId: 'portfolio1',
            type: 'platform',
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            autoRenew: true
          }
        ]
      });

      // Update expiration date (simulate renewal)
      const newExpirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      const updatedUser = await User.findOneAndUpdate(
        { _id: testUser._id, 'domains.domain': 'expires.com' },
        {
          $set: {
            'domains.$.expiresAt': newExpirationDate,
            'domains.$.lastPayment': new Date(),
            'domains.$.nextPayment': newExpirationDate
          }
        },
        { new: true }
      );

      const domain = updatedUser.domains[0];
      expect(domain.expiresAt).toEqual(newExpirationDate);
      expect(domain.lastPayment).toBeDefined();
      expect(domain.nextPayment).toEqual(newExpirationDate);
    });
  });

  describe('Data Validation', () => {
    test('should enforce required domain field', async () => {
      const userData = {
        email: 'validation@example.com',
        username: 'validationuser',
        password: 'hashedpassword123',
        domains: [
          {
            portfolioId: 'portfolio123'
            // missing required domain field
          }
        ]
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should validate domain type enum', async () => {
      const userData = {
        email: 'enumtest@example.com',
        username: 'enumtestuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'enumtest.com',
            portfolioId: 'portfolio123',
            type: 'invalid_type'
          }
        ]
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should validate domain status enum', async () => {
      const userData = {
        email: 'statustest@example.com',
        username: 'statustestuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'statustest.com',
            portfolioId: 'portfolio123',
            status: 'invalid_status'
          }
        ]
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });
  });
});
