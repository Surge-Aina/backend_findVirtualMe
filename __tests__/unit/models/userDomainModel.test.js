const { setupTestDB, teardownTestDB, clearTestDB } = require('../setup.js');
const User = require('../../../models/User.js');

describe('User Model - Domain Management', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('Domain Schema Validation', () => {
    test('should create user with single domain', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'testuser.com',
            portfolioId: 'portfolio123',
            type: 'platform',
            status: 'active'
          }
        ]
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.domains).toHaveLength(1);
      expect(savedUser.domains[0].domain).toBe('testuser.com');
      expect(savedUser.domains[0].portfolioId).toBe('portfolio123');
      expect(savedUser.domains[0].type).toBe('platform');
      expect(savedUser.domains[0].status).toBe('active');
      expect(savedUser.domains[0].registeredAt).toBeDefined();
    });

    test('should create user with multiple domains', async () => {
      const userData = {
        email: 'multi@example.com',
        username: 'multiuser',
        password: 'hashedpassword123',
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
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.domains).toHaveLength(2);
      expect(savedUser.domains[0].domain).toBe('domain1.com');
      expect(savedUser.domains[1].domain).toBe('domain2.com');
      expect(savedUser.domains[0].type).toBe('platform');
      expect(savedUser.domains[1].type).toBe('byod');
    });

    test('should use default values for domain fields', async () => {
      const userData = {
        email: 'defaults@example.com',
        username: 'defaultuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'defaultdomain.com',
            portfolioId: 'portfolio123'
          }
        ]
      };

      const user = new User(userData);
      const savedUser = await user.save();

      const domain = savedUser.domains[0];
      expect(domain.type).toBe('platform'); // default value
      expect(domain.status).toBe('pending'); // default value
      expect(domain.dnsConfigured).toBe(false); // default value
      expect(domain.sslIssued).toBe(false); // default value
      expect(domain.autoRenew).toBe(true); // default value
      expect(domain.registeredAt).toBeDefined();
    });

    test('should validate domain type enum', async () => {
      const userData = {
        email: 'enum@example.com',
        username: 'enumuser',
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
        email: 'status@example.com',
        username: 'statususer',
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

    test('should require domain field', async () => {
      const userData = {
        email: 'required@example.com',
        username: 'requireduser',
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

    test('should create user with complete domain data', async () => {
      const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const paymentDate = new Date();

      const userData = {
        email: 'complete@example.com',
        username: 'completeuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'complete.com',
            portfolioId: 'portfolio123',
            type: 'platform',
            status: 'active',
            expiresAt: expirationDate,
            dnsConfigured: true,
            sslIssued: true,
            subscriptionId: 'sub_stripe123',
            lastPayment: paymentDate,
            nextPayment: expirationDate,
            autoRenew: true
          }
        ]
      };

      const user = new User(userData);
      const savedUser = await user.save();

      const domain = savedUser.domains[0];
      expect(domain.domain).toBe('complete.com');
      expect(domain.portfolioId).toBe('portfolio123');
      expect(domain.type).toBe('platform');
      expect(domain.status).toBe('active');
      expect(domain.expiresAt).toEqual(expirationDate);
      expect(domain.dnsConfigured).toBe(true);
      expect(domain.sslIssued).toBe(true);
      expect(domain.subscriptionId).toBe('sub_stripe123');
      expect(domain.lastPayment).toEqual(paymentDate);
      expect(domain.nextPayment).toEqual(expirationDate);
      expect(domain.autoRenew).toBe(true);
    });
  });

  describe('Domain Operations', () => {
    test('should add domain to existing user', async () => {
      // Create user without domains
      const user = await User.create({
        email: 'addomain@example.com',
        username: 'addomainuser',
        password: 'hashedpassword123',
        domains: []
      });

      // Add domain
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          $push: {
            domains: {
              domain: 'newdomain.com',
              portfolioId: 'newportfolio',
              type: 'platform',
              status: 'active'
            }
          }
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe('newdomain.com');
    });

    test('should update domain status', async () => {
      const user = await User.create({
        email: 'updatestatus@example.com',
        username: 'updatestatususer',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'updateme.com',
            portfolioId: 'portfolio123',
            type: 'byod',
            status: 'pending'
          }
        ]
      });

      // Update domain status
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, 'domains.domain': 'updateme.com' },
        {
          $set: {
            'domains.$.status': 'active',
            'domains.$.dnsConfigured': true,
            'domains.$.sslIssued': true
          }
        },
        { new: true }
      );

      const domain = updatedUser.domains[0];
      expect(domain.status).toBe('active');
      expect(domain.dnsConfigured).toBe(true);
      expect(domain.sslIssued).toBe(true);
    });

    test('should remove domain from user', async () => {
      const user = await User.create({
        email: 'removedomain@example.com',
        username: 'removedomainuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'removeme.com',
            portfolioId: 'portfolio123'
          },
          {
            domain: 'keepme.com',
            portfolioId: 'portfolio456'
          }
        ]
      });

      // Remove specific domain
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          $pull: {
            domains: { domain: 'removeme.com' }
          }
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe('keepme.com');
    });

    test('should find user by domain', async () => {
      await User.create({
        email: 'findbydomain@example.com',
        username: 'findbydomainuser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'findme.com',
            portfolioId: 'portfolio123',
            status: 'active'
          }
        ]
      });

      const userWithDomain = await User.findOne({
        'domains.domain': 'findme.com',
        'domains.status': 'active'
      });

      expect(userWithDomain).toBeTruthy();
      expect(userWithDomain.email).toBe('findbydomain@example.com');
      expect(userWithDomain.domains[0].domain).toBe('findme.com');
    });

    test('should find domains by portfolio ID', async () => {
      await User.create({
        email: 'findbyportfolio@example.com',
        username: 'findbyportfoliouser',
        password: 'hashedpassword123',
        domains: [
          {
            domain: 'portfolio123.com',
            portfolioId: 'target_portfolio',
            status: 'active'
          },
          {
            domain: 'portfolio456.com',
            portfolioId: 'other_portfolio',
            status: 'active'
          }
        ]
      });

      const userWithPortfolio = await User.findOne({
        'domains.portfolioId': 'target_portfolio'
      });

      expect(userWithPortfolio).toBeTruthy();
      const targetDomain = userWithPortfolio.domains.find(
        d => d.portfolioId === 'target_portfolio'
      );
      expect(targetDomain.domain).toBe('portfolio123.com');
    });
  });

  describe('Legacy Compatibility', () => {
    test('should handle users without domains array', async () => {
      // Create user with old schema (no domains)
      const user = await User.create({
        email: 'legacy@example.com',
        username: 'legacyuser',
        password: 'hashedpassword123'
        // no domains field
      });

      expect(user.domains).toEqual([]);
    });

    test('should migrate from old domains string to new array', async () => {
      // This test simulates migration scenario
      const user = await User.create({
        email: 'migrate@example.com',
        username: 'migrateuser',
        password: 'hashedpassword123',
        domains: [] // Start with empty array
      });

      // Simulate adding first domain (like migration)
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          $push: {
            domains: {
              domain: 'migrated.com',
              portfolioId: 'migrated_portfolio',
              type: 'platform',
              status: 'active'
            }
          }
        },
        { new: true }
      );

      expect(updatedUser.domains).toHaveLength(1);
      expect(updatedUser.domains[0].domain).toBe('migrated.com');
    });
  });
});
