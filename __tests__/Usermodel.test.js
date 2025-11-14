const uniqueKey = () => `key_${Date.now()}_${Math.random()}`;
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;

const mongoose = require('mongoose');
const User = require('../../../models/User');

describe('User Model Validation Tests', () => {
  describe('Required Fields Validation', () => {
    test('should require email field', async () => {
      const userWithoutEmail = new User({
        username: 'testuser',
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      let error;
      try {
        await userWithoutEmail.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    test('should require password field', async () => {
      const userWithoutPassword = new User({
        email: 'test@example.com',
        username: 'testuser',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      let error;
      try {
        await userWithoutPassword.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    test('should require username field', async () => {
      const userWithoutUsername = new User({
        email: 'test@example.com',
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      let error;
      try {
        await userWithoutUsername.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.username).toBeDefined();
    });

    test('should create user with all required fields', async () => {
      const validUser = new User({
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await validUser.save();
      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBeDefined();
      expect(savedUser.username).toBeDefined();
    });
  });

  describe('Email Validation', () => {
    test('should validate correct email format', async () => {
      const validEmails = [
        `test1${Date.now()}@example.com`,
        `test2${Date.now()}@example.com`,
        `test3${Date.now()}@example.co.uk`
      ];

      for (const email of validEmails) {
        const user = new User({
          email,
          username: `user_${Date.now()}_${Math.random()}`,
          password: 'password123',
          userKey: uniqueKey(),
          practiceId: uniquePracticeId()
        });
        const savedUser = await user.save();
        expect(savedUser.email).toBe(email.toLowerCase());
      }
    });

    test('should handle email case sensitivity', async () => {
      const user = new User({
        email: `Test${Date.now()}@Example.COM`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.email).toMatch(/@example.com$/);
    });
  });

  describe('Role Validation', () => {
    test('should set default role if not provided', async () => {
      const user = new User({
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('customer');
    });

    test('should accept valid role values', async () => {
      const validRoles = ['admin', 'customer'];

      for (const role of validRoles) {
        const user = new User({
          email: `${role}${Date.now()}@example.com`,
          username: `${role}_user_${Date.now()}`,
          password: 'password123',
          role,
          userKey: uniqueKey(),
          practiceId: uniquePracticeId()
        });
        const savedUser = await user.save();
        expect(savedUser.role).toBe(role);
      }
    });

    test('should reject invalid role values', async () => {
      const invalidRoles = ['moderator', 'subscriber', 'guest'];

      for (const role of invalidRoles) {
        const user = new User({
          email: `${role}${Date.now()}@example.com`,
          username: `${role}_user_${Date.now()}`,
          password: 'password123',
          role,
          userKey: uniqueKey(),
          practiceId: uniquePracticeId()
        });

        let error;
        try {
          await user.save();
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
      }
    });
  });

  describe('Timestamp Fields', () => {
    test('should automatically set createdAt on creation', async () => {
      const user = new User({
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.createdAt).toBeInstanceOf(Date);
    });

    test('should automatically set updatedAt on creation', async () => {
      const user = new User({
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.updatedAt).toBeDefined();
      expect(savedUser.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('JSON output', () => {
    test('should not include password in JSON output', async () => {
      const user = await User.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        username: `testuser${Date.now()}`,
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const userJSON = user.toJSON();
      expect(userJSON.password).toBeUndefined();
    });

    test('should include other fields in JSON output', async () => {
      const user = await User.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        username: `testuser${Date.now()}`,
        firstName: 'John',
        lastName: 'Doe',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const userJSON = user.toJSON();
      expect(userJSON.email).toBeDefined();
      expect(userJSON.username).toBeDefined();
      expect(userJSON.firstName).toBe('John');
      expect(userJSON.lastName).toBe('Doe');
      expect(userJSON.__v).toBeUndefined();
    });
  });

  describe('Model Indexes', () => {
    test('should have index on email field', () => {
      const indexes = User.schema.indexes();
      const emailIndex = indexes.find(index => index[0].email);
      expect(emailIndex).toBeDefined();
    });

    test('should enforce unique email constraint', async () => {
      const timestamp = Date.now();
      const email = `unique${timestamp}@example.com`;

      await User.create({
        email,
        username: `user1_${timestamp}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      let error;
      try {
        await User.create({
          email,
          username: `user2_${Date.now()}`,
          password: 'password456',
          userKey: uniqueKey(),
          practiceId: uniquePracticeId()
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000);
    });
  });

  describe('Model Edge Cases', () => {
    test('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(50) + `${Date.now()}@` + 'b'.repeat(50) + '.com';
      
      const user = new User({
        email: longEmail,
        username: `testuser${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.email).toBe(longEmail.toLowerCase());
    });

    test('should handle special characters in username', async () => {
      const user = new User({
        email: `test${Date.now()}@example.com`,
        username: `test_user-${Date.now()}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.username).toContain('test_user-');
    });

    test('should handle concurrent user creation attempts', async () => {
      const timestamp = Date.now();
      const users = Array.from({ length: 5 }, (_, i) => ({
        email: `user${i}_${timestamp}@example.com`,
        username: `user${i}_${timestamp}`,
        password: 'password123',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      }));

      const results = await Promise.all(
        users.map(userData => User.create(userData))
      );

      expect(results).toHaveLength(5);
      results.forEach(user => {
        expect(user._id).toBeDefined();
      });
    });
  });

  describe('Additional User Fields', () => {
    test('should handle optional fields if present', async () => {
      const user = new User({
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        location: 'New York',
        bio: 'Test bio',
        userKey: uniqueKey(),
        practiceId: uniquePracticeId()
      });

      const savedUser = await user.save();
      expect(savedUser.firstName).toBe('John');
      expect(savedUser.lastName).toBe('Doe');
      expect(savedUser.phone).toBe('+1234567890');
      expect(savedUser.location).toBe('New York');
      expect(savedUser.bio).toBe('Test bio');
    });
  });
});