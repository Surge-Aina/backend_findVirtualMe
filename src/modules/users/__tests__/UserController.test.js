const uniqueKey = () => `key_${Date.now()}_${Math.random()}`;
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;

process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_fake_key_for_testing_only';
process.env.STRIPE_MODE = 'test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const User = require('../../../shared/models/User');
const userRoutes = require('../../../../routes/userRoute');
const authHttpRoutes = require('../../auth/auth.http.routes');

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/auth', authHttpRoutes);

let testUser;
let otherUser;
let adminUser;
let authToken;
let otherToken;
let adminToken;

async function makeUser(role) {
  return User.create({
    email: getUniqueEmail(),
    username: getUniqueUsername(),
    password: await bcrypt.hash('password123', 10),
    firstName: 'Test',
    lastName: 'User',
    userKey: uniqueKey(),
    practiceId: uniquePracticeId(),
    role,
    stripeCustomerId: `cus_${role}_${Date.now()}`,
    stripeSubscriptionId: `sub_${role}_${Date.now()}`,
    resetPasswordToken: `reset_${role}`,
  });
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(async () => {
  testUser = await makeUser('customer');
  otherUser = await makeUser('customer');
  adminUser = await makeUser('admin');
  authToken = signToken(testUser);
  otherToken = signToken(otherUser);
  adminToken = signToken(adminUser);
});

const getUniqueEmail = () => `test${Date.now()}_${Math.random()}@example.com`;
const getUniqueUsername = () => `user${Date.now()}_${Math.random()}`;

describe('User Controller Integration Tests', () => {
  
  describe('POST /api/users - Create User', () => {
    test('should create a new user with valid data', async () => {
      const newUser = {
        data: {
          userInfo: {
            firstName: "John",
            lastName: "Doe",
            username: getUniqueUsername(),
            email: getUniqueEmail(),
            phone: "+1234567890",
            location: "USA",
            bio: "Test bio",
            password: "password123"
          },
          goal: "Learn coding",
          industry: "Tech",
          experience: "Beginner",
          skills: ["JavaScript"],
          sessionId: null
        }
      };

      const response = await request(app)
        .post('/api/users')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(newUser.data.userInfo.email);
      expect(response.body.user.role).toBe('customer');
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.stripeCustomerId).toBeUndefined();
      expect(response.body.user.resetPasswordToken).toBeUndefined();
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          data: {
            userInfo: {
              email: getUniqueEmail()
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    test('should return 400 for duplicate email', async () => {
      const email = getUniqueEmail();
      
      await request(app)
        .post('/api/users')
        .send({
          data: {
            userInfo: {
              email,
              username: getUniqueUsername(),
              password: 'Pass123'
            }
          }
        });

      const response = await request(app)
        .post('/api/users')
        .send({
          data: {
            userInfo: {
              email,
              username: getUniqueUsername(),
              password: 'Pass456'
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/exists/i);
    });

    test('should set default role to customer', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          data: {
            userInfo: {
              email: getUniqueEmail(),
              username: getUniqueUsername(),
              password: 'Pass123'
            }
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('customer');
    });
  });

  describe('GET /api/users', () => {
    test('should return 401 when unauthenticated', async () => {
      await request(app).get('/api/users').expect(401);
    });

    test('should return 403 for a non-admin', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    test('should return all users for an admin without secrets', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      const listed = response.body.users.find(
        (user) => user._id === testUser._id.toString()
      );
      expect(listed.email).toBe(testUser.email);
      expect(listed.password).toBeUndefined();
      expect(listed.stripeCustomerId).toBeUndefined();
      expect(listed.resetPasswordToken).toBeUndefined();
    });
  });

  describe('GET /api/users/:id', () => {
    test('should return 401 when unauthenticated', async () => {
      await request(app).get(`/api/users/${testUser._id}`).expect(401);
    });

    test('should return the caller their own record', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user._id).toBe(testUser._id.toString());
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.stripeCustomerId).toBeUndefined();
      expect(response.body.user.resetPasswordToken).toBeUndefined();
    });

    test('should return 403 when a user reads someone else', async () => {
      const response = await request(app)
        .get(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.user).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(otherUser.email);
    });

    test('should allow an admin to read another user', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.password).toBeUndefined();
    });

    test('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/users/public/:id', () => {
    test('should return a display projection without email or secrets', async () => {
      const response = await request(app)
        .get(`/api/users/public/${testUser._id}`)
        .expect(200);

      expect(response.body.user.username).toBe(testUser.username);
      expect(response.body.user.email).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.stripeCustomerId).toBeUndefined();
      expect(response.body.user.resetPasswordToken).toBeUndefined();
    });
  });

  describe('PATCH /api/users', () => {
    test('should update user with valid data', async () => {
      const response = await request(app)
        .patch(`/api/users`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(response.body.user.firstName).toBe('Updated');
    });

    test('should ignore role changes from a non-admin', async () => {
      const response = await request(app)
        .patch('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'admin', isAdmin: true, password: 'stolen-hash' })
        .expect(200);

      expect(response.body.user.role).toBe('customer');
      expect(response.body.user.password).toBeUndefined();
      const stored = await User.findById(testUser._id);
      expect(stored.role).toBe('customer');
      expect(stored.password).toBe(testUser.password);
    });

    test('should return 403 when a user updates someone else', async () => {
      await request(app)
        .patch(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Hijack' })
        .expect(403);

      const stored = await User.findById(otherUser._id);
      expect(stored.firstName).toBe('Test');
    });

    test('should let an admin update another user and change role', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin', firstName: 'Promoted' })
        .expect(200);

      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.firstName).toBe('Promoted');
      expect(response.body.user.password).toBeUndefined();
    });
  });

  describe('DELETE /api/users/:id', () => {
    test('should return 401 when unauthenticated', async () => {
      await request(app).delete(`/api/users/${testUser._id}`).expect(401);
      expect(await User.findById(testUser._id)).not.toBeNull();
    });

    test('should return 403 for a non-admin', async () => {
      await request(app)
        .delete(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      expect(await User.findById(otherUser._id)).not.toBeNull();
    });

    test('should delete user when caller is an admin', async () => {
      await request(app)
        .delete(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedUser = await User.findById(testUser._id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('GET /api/users/me', () => {
    test('should return current authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user._id).toBe(testUser._id.toString());
    });

    test('should return 401 without token', async () => {
      await request(app)
        .get('/api/users/me')
        .expect(401);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
    });
  });

  describe('POST /api/auth/signup', () => {
    test('should create new user on signup', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'New User',
          username: getUniqueUsername(),
          email: getUniqueEmail(),
          password: 'SecurePass123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
    });
  });
});