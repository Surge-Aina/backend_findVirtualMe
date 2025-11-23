const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/cleaningLady/userModel2'); 

let mongoServer;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Clear all users after each test
  await User.deleteMany();
});

describe('User Model Tests (Cleaning Lady)', () => {

  describe('✅ Successful User Creation', () => {
    it('should create a user successfully with all required fields', async () => {
      const userData = {
        email: 'cleaner@example.com',
        password: 'hashedPassword123',
      };

      const user = await User.create(userData);

      expect(user.email).toBe('cleaner@example.com');
      expect(user.password).toBe('hashedPassword123');
      expect(user.isAdmin).toBe(false); // Default value
      expect(user._id).toBeDefined();
    });

    it('should create an admin user when isAdmin is true', async () => {
      const adminData = {
        email: 'admin@example.com',
        password: 'adminPassword123',
        isAdmin: true,
      };

      const admin = await User.create(adminData);

      expect(admin.email).toBe('admin@example.com');
      expect(admin.isAdmin).toBe(true);
    });

    it('should create a regular user when isAdmin is false', async () => {
      const userData = {
        email: 'customer@example.com',
        password: 'customerPass123',
        isAdmin: false,
      };

      const user = await User.create(userData);

      expect(user.isAdmin).toBe(false);
    });

    it('should set isAdmin to false by default', async () => {
      const userData = {
        email: 'user@example.com',
        password: 'password123',
        // isAdmin not specified
      };

      const user = await User.create(userData);

      expect(user.isAdmin).toBe(false);
    });

    it('should create timestamps automatically', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const user = await User.create(userData);

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

 
  describe('📧 Email Field Tests', () => {
    it('should convert email to lowercase', async () => {
      const userData = {
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'password123',
      };

      const user = await User.create(userData);

      expect(user.email).toBe('uppercase@example.com');
    });

    it('should trim whitespace from email', async () => {
      const userData = {
        email: '  spaces@example.com  ',
        password: 'password123',
      };

      const user = await User.create(userData);

      expect(user.email).toBe('spaces@example.com');
    });

    it('should convert email to lowercase and trim simultaneously', async () => {
      const userData = {
        email: '  MIXED@EXAMPLE.COM  ',
        password: 'password123',
      };

      const user = await User.create(userData);

      expect(user.email).toBe('mixed@example.com');
    });

    it('should handle email with special characters', async () => {
      const userData = {
        email: 'user+tag@example.com',
        password: 'password123',
      };

      const user = await User.create(userData);

      expect(user.email).toBe('user+tag@example.com');
    });
  });

  
  describe('❌ Validation Tests - Required Fields', () => {
    it('should fail if email is missing', async () => {
      const userData = {
        password: 'password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail if password is missing', async () => {
      const userData = {
        email: 'test@example.com',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail if both email and password are missing', async () => {
      const userData = {
        isAdmin: true,
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with empty email string', async () => {
      const userData = {
        email: '',
        password: 'password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with empty password string', async () => {
      const userData = {
        email: 'test@example.com',
        password: '',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

 
  describe('🔒 Unique Email Constraint', () => {
    it('should not allow duplicate emails', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
      };

      // Create first user
      await User.create(userData);

      
      await expect(
        User.create({
          email: 'duplicate@example.com',
          password: 'differentPassword',
        })
      ).rejects.toThrow();
    });

    it('should not allow duplicate emails regardless of case', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
      });

   
      await expect(
        User.create({
          email: 'TEST@EXAMPLE.COM',
          password: 'password456',
        })
      ).rejects.toThrow();
    });

    it('should not allow duplicate emails with whitespace differences', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
      });

   
      await expect(
        User.create({
          email: '  test@example.com  ',
          password: 'password456',
        })
      ).rejects.toThrow();
    });

    it('should allow different emails', async () => {
      await User.create({
        email: 'user1@example.com',
        password: 'password123',
      });

      const user2 = await User.create({
        email: 'user2@example.com',
        password: 'password456',
      });

      expect(user2.email).toBe('user2@example.com');
    });
  });

  describe('🔐 Password Field Tests', () => {
    it('should store password as provided (bcrypt hash)', async () => {
      const hashedPassword = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890';
      
      const user = await User.create({
        email: 'test@example.com',
        password: hashedPassword,
      });

      expect(user.password).toBe(hashedPassword);
    });

    it('should allow long passwords (hashed)', async () => {
      const longHash = 'a'.repeat(100);
      
      const user = await User.create({
        email: 'test@example.com',
        password: longHash,
      });

      expect(user.password).toBe(longHash);
    });

    it('should store different passwords for different users', async () => {
      const user1 = await User.create({
        email: 'user1@example.com',
        password: 'hash1',
      });

      const user2 = await User.create({
        email: 'user2@example.com',
        password: 'hash2',
      });

      expect(user1.password).toBe('hash1');
      expect(user2.password).toBe('hash2');
    });
  });

 
  describe('👤 isAdmin Field Tests', () => {
    it('should accept true for isAdmin', async () => {
      const user = await User.create({
        email: 'admin@example.com',
        password: 'password',
        isAdmin: true,
      });

      expect(user.isAdmin).toBe(true);
    });

    it('should accept false for isAdmin', async () => {
      const user = await User.create({
        email: 'user@example.com',
        password: 'password',
        isAdmin: false,
      });

      expect(user.isAdmin).toBe(false);
    });

    it('should default to false when isAdmin is not provided', async () => {
      const user = await User.create({
        email: 'user@example.com',
        password: 'password',
      });

      expect(user.isAdmin).toBe(false);
    });

    it('should allow updating isAdmin from false to true', async () => {
      const user = await User.create({
        email: 'user@example.com',
        password: 'password',
        isAdmin: false,
      });

      user.isAdmin = true;
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isAdmin).toBe(true);
    });

    it('should allow updating isAdmin from true to false', async () => {
      const user = await User.create({
        email: 'admin@example.com',
        password: 'password',
        isAdmin: true,
      });

      user.isAdmin = false;
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isAdmin).toBe(false);
    });
  });

  
  describe('🔍 Query Tests', () => {
    beforeEach(async () => {
      // Create test users
      await User.create([
        { email: 'admin@example.com', password: 'pass1', isAdmin: true },
        { email: 'user1@example.com', password: 'pass2', isAdmin: false },
        { email: 'user2@example.com', password: 'pass3', isAdmin: false },
      ]);
    });

    it('should find user by email', async () => {
      const user = await User.findOne({ email: 'admin@example.com' });

      expect(user).toBeDefined();
      expect(user.email).toBe('admin@example.com');
      expect(user.isAdmin).toBe(true);
    });

    it('should find all admin users', async () => {
      const admins = await User.find({ isAdmin: true });

      expect(admins).toHaveLength(1);
      expect(admins[0].email).toBe('admin@example.com');
    });

    it('should find all non-admin users', async () => {
      const users = await User.find({ isAdmin: false });

      expect(users).toHaveLength(2);
    });

    it('should count total users', async () => {
      const count = await User.countDocuments();

      expect(count).toBe(3);
    });

    it('should return null for non-existent email', async () => {
      const user = await User.findOne({ email: 'nonexistent@example.com' });

      expect(user).toBeNull();
    });
  });

  
  describe('✏️ Update Tests', () => {
    it('should update user password', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'oldPassword',
      });

      user.password = 'newPassword';
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.password).toBe('newPassword');
    });

    it('should update timestamps on save', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password',
      });

      const originalUpdatedAt = user.updatedAt;

      
      await new Promise(resolve => setTimeout(resolve, 10));

      user.password = 'newPassword';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should not allow updating email to duplicate', async () => {
      await User.create({
        email: 'existing@example.com',
        password: 'password1',
      });

      const user2 = await User.create({
        email: 'unique@example.com',
        password: 'password2',
      });

      user2.email = 'existing@example.com';
      
      await expect(user2.save()).rejects.toThrow();
    });
  });


  describe('🗑️ Delete Tests', () => {
    it('should delete user by ID', async () => {
      const user = await User.create({
        email: 'delete@example.com',
        password: 'password',
      });

      await User.findByIdAndDelete(user._id);

      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });

    it('should delete user by email', async () => {
      await User.create({
        email: 'delete@example.com',
        password: 'password',
      });

      await User.deleteOne({ email: 'delete@example.com' });

      const deletedUser = await User.findOne({ email: 'delete@example.com' });
      expect(deletedUser).toBeNull();
    });

    it('should delete multiple users', async () => {
      await User.create([
        { email: 'user1@example.com', password: 'pass1' },
        { email: 'user2@example.com', password: 'pass2' },
        { email: 'user3@example.com', password: 'pass3' },
      ]);

      await User.deleteMany({ isAdmin: false });

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });
  });


  describe('📋 Schema Structure Tests', () => {
    it('should have correct field types', () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        isAdmin: true,
      });

      expect(typeof user.email).toBe('string');
      expect(typeof user.password).toBe('string');
      expect(typeof user.isAdmin).toBe('boolean');
    });

    it('should not allow extra fields', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password',
        extraField: 'should not exist',
      });

      expect(user.extraField).toBeUndefined();
    });
  });
});