const uniqueKey = () => `key_${Date.now()}_${Math.random()}`;
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;

process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_fake_key_for_testing_only';
process.env.STRIPE_MODE = 'test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const User = require('../../../models/User');
const userRoutes = require('../../../routes/userRoute');

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

let testUser;
let authToken;

beforeEach(async () => {
  testUser = await User.create({
    email: `test${Date.now()}@example.com`,
    username: `user${Date.now()}`,
    password: await bcrypt.hash('password123', 10),
    firstName: 'Test',
    lastName: 'User',
    userKey: uniqueKey(),
    practiceId: uniquePracticeId(),
    role: 'customer'
  });

  authToken = jwt.sign(
    { id: testUser._id, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

const getUniqueEmail = () => `test${Date.now()}_${Math.random()}@example.com`;
const getUniqueUsername = () => `user${Date.now()}_${Math.random()}`;

describe('User Controller Integration Tests', () => {
  
  describe('POST /api/users/addUser - Create User', () => {
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
        .post('/api/users/addUser')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(newUser.data.userInfo.email);
      expect(response.body.user.role).toBe('customer');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/users/addUser')
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
        .post('/api/users/addUser')
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
        .post('/api/users/addUser')
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
        .post('/api/users/addUser')
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

  describe('GET /api/users/getAllUsers', () => {
    test('should return all users', async () => {
      const response = await request(app)
        .get('/api/users/getAllUsers')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });
  });

  describe('GET /api/users/getUser/:id', () => {
    test('should return user by valid ID', async () => {
      const response = await request(app)
        .get(`/api/users/getUser/${testUser._id}`)
        .expect(200);

      expect(response.body.user._id).toBe(testUser._id.toString());
    });

    test('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/users/getUser/${fakeId}`)
        .expect(404);
    });
  });

  describe('PATCH /api/users/updateUser/:id', () => {
    test('should update user with valid data', async () => {
      const response = await request(app)
        .patch(`/api/users/updateUser/${testUser._id}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(response.body.user.firstName).toBe('Updated');
    });
  });

  describe('DELETE /api/users/deleteUser/:id', () => {
    test('should delete user with valid ID', async () => {
      await request(app)
        .delete(`/api/users/deleteUser/${testUser._id}`)
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

  describe('POST /api/users/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
    });
  });

  describe('POST /api/users/signup', () => {
    test('should create new user on signup', async () => {
      const response = await request(app)
        .post('/api/users/signup')
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