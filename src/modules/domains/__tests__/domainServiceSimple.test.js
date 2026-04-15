const User = require("../../../shared/models/User.js");
const mongoose = require("mongoose");

function portfolioDoc(type = "project-manager") {
  return {
    portfolioId: new mongoose.Types.ObjectId(),
    portfolioType: type,
  };
}

async function clearTestDB() {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

describe("Domain Service - Database Operations", () => {
  beforeEach(async () => {
    await clearTestDB();
  });

  describe('User Domain Management', () => {
    test("should add domain to user via database operation", async () => {
      const p = portfolioDoc();
      const pid = p.portfolioId.toString();
      const testUser = await User.create({
        email: "test@example.com",
        username: "testuser",
        password: "hashedpassword123",
        portfolios: [p],
      });

      // Simulate domain registration database update
      const updatedUser = await User.findByIdAndUpdate(
        testUser._id,
        {
          $push: {
            domains: {
              domain: "testdomain.com",
              portfolioId: pid,
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
      expect(updatedUser.domains[0].portfolioId).toBe(pid);
      expect(updatedUser.domains[0].type).toBe("platform");
      expect(updatedUser.domains[0].status).toBe("active");
    });

    test("should add BYOD domain to user", async () => {
      const p = portfolioDoc();
      const pid = p.portfolioId.toString();
      const testUser = await User.create({
        email: "byod@example.com",
        username: "byoduser",
        password: "hashedpassword123",
        portfolios: [p],
      });

      // Simulate BYOD configuration database update
      const updatedUser = await User.findByIdAndUpdate(
        testUser._id,
        {
          $push: {
            domains: {
              domain: "mycustom.com",
              portfolioId: pid,
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
      expect(updatedUser.domains[0].portfolioId).toBe(pid);
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
      const p1 = portfolioDoc();
      const p2 = portfolioDoc();
      const id1 = p1.portfolioId.toString();
      const id2 = p2.portfolioId.toString();
      const testUser = await User.create({
        email: 'getdomains@example.com',
        username: 'getdomainsuser',
        password: 'hashedpassword123',
        portfolios: [p1, p2],
        domains: [
          {
            domain: 'domain1.com',
            portfolioId: id1,
            type: 'platform',
            status: 'active'
          },
          {
            domain: 'domain2.com',
            portfolioId: id2,
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
      const p1 = portfolioDoc();
      const p2 = portfolioDoc();
      const testUser = await User.create({
        email: 'removedomain@example.com',
        username: 'removedomainuser',
        password: 'hashedpassword123',
        portfolios: [p1, p2],
        domains: [
          {
            domain: 'keepme.com',
            portfolioId: p1.portfolioId.toString()
          },
          {
            domain: 'deleteme.com',
            portfolioId: p2.portfolioId.toString()
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
      const p = portfolioDoc();
      const pid = p.portfolioId.toString();
      const testUser = await User.create({
        email: 'multidomains@example.com',
        username: 'multidomainsuser',
        password: 'hashedpassword123',
        portfolios: [p],
        domains: [
          {
            domain: 'main.com',
            portfolioId: pid,
            type: 'platform',
            status: 'active'
          },
          {
            domain: 'www.main.com',
            portfolioId: pid,
            type: 'byod',
            status: 'active'
          }
        ]
      });

      // Find all domains for a specific portfolio
      const userWithPortfolio = await User.findOne({
        'domains.portfolioId': pid
      });

      const portfolio1Domains = userWithPortfolio.domains.filter(
        d => d.portfolioId === pid
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
