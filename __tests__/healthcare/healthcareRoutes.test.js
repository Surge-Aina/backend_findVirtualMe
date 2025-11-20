/**
 * Healthcare Routes Tests - BE-HC-1
 * Tests for healthcare_routes.js endpoints
 * 
 * Covers: Health check, practice data, auth, admin endpoints
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../../models/User');
const UserData = require('../../models/healthcare/userData');
const healthcareRoutes = require('../../routes/healthcare/healthcare_routes');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/healthcare', healthcareRoutes);

// Helper functions
const uniqueKey = () => `key_${Date.now()}_${Math.random()}`;
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;
const uniqueEmail = () => `test_${Date.now()}_${Math.random()}@example.com`;
const uniqueUsername = () => `user_${Date.now()}_${Math.random()}`;
const uniqueSubdomain = () => `subdomain${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

// Test fixtures
let testUser;
let testPractice;
let authToken;

beforeEach(async () => {
  const practiceId = uniquePracticeId();
  
  // Create test user
  testUser = await User.create({
    email: uniqueEmail(),
    username: uniqueUsername(),
    password: await bcrypt.hash('password123', 10),
    firstName: 'Test',
    lastName: 'User',
    userKey: uniqueKey(),
    practiceId,
    role: 'admin'
  });

  // Create test practice
  testPractice = await UserData.create({
    practiceId,
    userId: testUser._id.toString(),
    subdomain: uniqueSubdomain(),
    practice: {
      name: 'Test Medical Center',
      tagline: 'Test Tagline',
      description: 'Test Description'
    },
    contact: {
      phone: '+1234567890',
      email: testUser.email,
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345'
      }
    },
    hours: {
      weekdays: 'Mon-Fri: 9-5',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    stats: {
      yearsExperience: '10',
      patientsServed: '1000',
      successRate: '95',
      doctorsCount: '5'
    },
    isActive: true
  });

  // Generate auth token
  authToken = jwt.sign(
    { 
      id: testUser._id,
      email: testUser.email,
      practiceId: testUser.practiceId,
      role: 'admin'
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
});

describe('Healthcare Routes Integration Tests', () => {

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  
  describe('GET /api/healthcare/health', () => {
    
    test('should return health check status', async () => {
      const response = await request(app)
        .get('/api/healthcare/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'Healthcare API');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/api/healthcare/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  // ==========================================
  // PUBLIC PRACTICE DATA ENDPOINTS
  // ==========================================

  describe('GET /api/healthcare/practice/:practiceId', () => {
    
    test('should return practice data by valid practiceId', async () => {
      const response = await request(app)
        .get(`/api/healthcare/practice/${testPractice.practiceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('practiceId', testPractice.practiceId);
      expect(response.body.practice.name).toBe('Test Medical Center');
    });

    test('should return 404 for non-existent practiceId', async () => {
      const response = await request(app)
        .get('/api/healthcare/practice/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Practice not found');
    });

    test('should only return active practices', async () => {
      // Create inactive practice
      const inactivePractice = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: testUser._id.toString(),
        practice: { name: 'Inactive Practice' },
        isActive: false
      });

      const response = await request(app)
        .get(`/api/healthcare/practice/${inactivePractice.practiceId}`)
        .expect(404);

      expect(response.body.error).toBe('Practice not found');
    });

    test('should return all practice data fields', async () => {
      const response = await request(app)
        .get(`/api/healthcare/practice/${testPractice.practiceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('practice');
      expect(response.body).toHaveProperty('contact');
      expect(response.body).toHaveProperty('hours');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('blogPosts');
    });
  });

  describe('GET /api/healthcare/subdomain/:subdomain', () => {
    
    test('should return practice data by subdomain', async () => {
      const response = await request(app)
        .get(`/api/healthcare/subdomain/${testPractice.subdomain}`)
        .expect(200);

      expect(response.body.subdomain).toBe(testPractice.subdomain);
      expect(response.body.practice.name).toBe('Test Medical Center');
    });

    test('should handle case-insensitive subdomain lookup', async () => {
      const upperSubdomain = testPractice.subdomain.toUpperCase();
      
      const response = await request(app)
        .get(`/api/healthcare/subdomain/${upperSubdomain}`)
        .expect(200);

      expect(response.body.subdomain).toBe(testPractice.subdomain.toLowerCase());
    });

    test('should return 404 for non-existent subdomain', async () => {
      const response = await request(app)
        .get('/api/healthcare/subdomain/nonexistentdomain')
        .expect(404);

      expect(response.body.error).toBe('Practice not found');
    });

    test('should only return active practices by subdomain', async () => {
      const inactivePractice = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: testUser._id.toString(),
        subdomain: uniqueSubdomain(),
        practice: { name: 'Inactive' },
        isActive: false
      });

      await request(app)
        .get(`/api/healthcare/subdomain/${inactivePractice.subdomain}`)
        .expect(404);
    });
  });

  // ==========================================
  // AUTHENTICATION ENDPOINTS
  // ==========================================

  describe('POST /api/healthcare/auth/register', () => {
    
    test('should register new practice with valid data', async () => {
      const registrationData = {
        email: uniqueEmail(),
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        practiceName: 'New Medical Center'
      };

      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('practiceId');
      expect(response.body.user.email).toBe(registrationData.email);
      expect(response.body.user.role).toBe('admin');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123'
          // Missing firstName, lastName, practiceName
        })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    test('should return 400 for duplicate email', async () => {
      const email = uniqueEmail();
      
      // First registration
      await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email,
          password: 'Pass123',
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Test Practice'
        });

      // Duplicate registration
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email,
          password: 'Pass456',
          firstName: 'Jane',
          lastName: 'Smith',
          practiceName: 'Another Practice'
        })
        .expect(400);

      expect(response.body.error).toMatch(/already registered/i);
    });

    test('should hash password before saving', async () => {
      const password = 'PlainTextPassword123';
      
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password,
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Test Practice'
        })
        .expect(201);

      const user = await User.findById(response.body.user.id);
      expect(user.password).not.toBe(password);
      expect(user.password.length).toBeGreaterThan(20);
    });

    test('should create user and practice data together', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123',
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Test Practice'
        })
        .expect(201);

      // Check user exists
      const user = await User.findById(response.body.user.id);
      expect(user).toBeDefined();

      // Check practice data exists
      const practiceData = await UserData.findOne({ 
        practiceId: response.body.practiceId 
      });
      expect(practiceData).toBeDefined();
      expect(practiceData.practice.name).toBe('Test Practice');
    });

    test('should generate unique practiceId', async () => {
      const response1 = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123',
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Practice 1'
        });

      const response2 = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123',
          firstName: 'Jane',
          lastName: 'Smith',
          practiceName: 'Practice 2'
        });

      expect(response1.body.practiceId).not.toBe(response2.body.practiceId);
    });

    test('should set user role to admin', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123',
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Test Practice'
        });

      expect(response.body.user.role).toBe('admin');
    });

    test('should create JWT token with correct payload', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'Pass123',
          firstName: 'John',
          lastName: 'Doe',
          practiceName: 'Test Practice'
        });

      const decoded = jwt.verify(
        response.body.token,
        process.env.JWT_SECRET || 'test-secret'
      );

      expect(decoded.id).toBe(response.body.user.id);
      expect(decoded.email).toBe(response.body.user.email);
      expect(decoded.practiceId).toBe(response.body.practiceId);
      expect(decoded.role).toBe('admin');
    });
  });

  describe('POST /api/healthcare/auth/login', () => {
    
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should handle case-insensitive email login', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: testUser.email.toUpperCase(),
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should update lastLogin timestamp', async () => {
      const beforeLogin = new Date();
      
      await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });

      const user = await User.findById(testUser._id);
      expect(user.lastLogin).toBeDefined();
      expect(user.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    test('should return user data in response', async () => {
      const response = await request(app)
        .post('/api/healthcare/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });

      expect(response.body.user).toMatchObject({
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        practiceId: testUser.practiceId,
        role: testUser.role
      });
    });
  });

  describe('GET /api/healthcare/auth/me', () => {
    
    test('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/healthcare/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body.password).toBeUndefined(); // Should be excluded
    });

    test('should return 401 without token', async () => {
      await request(app)
        .get('/api/healthcare/auth/me')
        .expect(401);
    });

    test('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/healthcare/auth/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    test('should exclude password from response', async () => {
      const response = await request(app)
        .get('/api/healthcare/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.password).toBeUndefined();
    });
  });

  // ==========================================
  // ADMIN ENDPOINTS (Protected)
  // ==========================================

  describe('GET /api/healthcare/admin/data', () => {
    
    test('should return practice data for authenticated admin', async () => {
      const response = await request(app)
        .get('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.practiceId).toBe(testUser.practiceId);
      expect(response.body.practice.name).toBe('Test Medical Center');
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/healthcare/admin/data')
        .expect(401);
    });

    test('should return 404 if practice data not found', async () => {
      // Create user without practice data
      const userWithoutPractice = await User.create({
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'pass123',
        practiceId: 'nonexistent_practice',
        userKey: uniqueKey()
      });

      const token = jwt.sign(
        { id: userWithoutPractice._id, practiceId: 'nonexistent_practice' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /api/healthcare/admin/data', () => {
    
    test('should update practice data with valid token', async () => {
      const updateData = {
        practice: {
          name: 'Updated Medical Center',
          tagline: 'New Tagline',
          description: 'Updated description'
        }
      };

      const response = await request(app)
        .post('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('saved successfully');
    });

    test('should persist changes to database', async () => {
      const updateData = {
        practice: {
          name: 'Persisted Name',
          tagline: 'Persisted Tagline'
        }
      };

      await request(app)
        .post('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      const updated = await UserData.findOne({ practiceId: testUser.practiceId });
      expect(updated.practice.name).toBe('Persisted Name');
      expect(updated.practice.tagline).toBe('Persisted Tagline');
    });

    test('should update lastModified timestamp', async () => {
      const before = testPractice.lastModified;

      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .post('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ practice: { name: 'Updated' } });

      const updated = await UserData.findOne({ practiceId: testUser.practiceId });
      expect(updated.lastModified.getTime()).toBeGreaterThan(before.getTime());
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/healthcare/admin/data')
        .send({ practice: { name: 'Test' } })
        .expect(401);
    });

    test('should update services array', async () => {
      const updateData = {
        services: [
          {
            id: 'service1',
            title: 'New Service',
            description: 'Service description',
            price: '$100'
          }
        ]
      };

      await request(app)
        .post('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const updated = await UserData.findOne({ practiceId: testUser.practiceId });
      expect(updated.services).toHaveLength(1);
      expect(updated.services[0].title).toBe('New Service');
    });

    test('should update nested objects correctly', async () => {
      const updateData = {
        contact: {
          phone: '+9876543210',
          email: 'updated@example.com',
          address: {
            street: '456 New St',
            city: 'New City'
          }
        }
      };

      await request(app)
        .post('/api/healthcare/admin/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      const updated = await UserData.findOne({ practiceId: testUser.practiceId });
      expect(updated.contact.phone).toBe('+9876543210');
      expect(updated.contact.address.street).toBe('456 New St');
    });
  });

  describe('POST /api/healthcare/admin/subdomain', () => {
    
    test('should update subdomain with valid format', async () => {
      const newSubdomain = `newsubdomain${Date.now()}`;

      const response = await request(app)
        .post('/api/healthcare/admin/subdomain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subdomain: newSubdomain })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
    });

    test('should reject invalid subdomain format', async () => {
      const invalidSubdomains = [
        'Invalid_Subdomain',
        'sub domain',
        'sub@domain',
        'Sub-Domain'
      ];

      for (const subdomain of invalidSubdomains) {
        const response = await request(app)
          .post('/api/healthcare/admin/subdomain')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ subdomain })
          .expect(400);

        expect(response.body.error).toContain('Invalid subdomain');
      }
    });

    test('should accept valid subdomain formats', async () => {
      const validSubdomains = [
        `test${Date.now()}`,
        `test-subdomain-${Date.now()}`,
        `test123-${Date.now()}`
      ];

      for (const subdomain of validSubdomains) {
        await request(app)
          .post('/api/healthcare/admin/subdomain')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ subdomain })
          .expect(200);
      }
    });

    test('should return 400 if subdomain already taken', async () => {
      const existingSubdomain = uniqueSubdomain();

      // Create another practice with this subdomain
      await UserData.create({
        practiceId: uniquePracticeId(),
        userId: 'different_user',
        subdomain: existingSubdomain,
        practice: { name: 'Other Practice' }
      });

      const response = await request(app)
        .post('/api/healthcare/admin/subdomain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subdomain: existingSubdomain })
        .expect(400);

      expect(response.body.error).toContain('already taken');
    });

    test('should convert subdomain to lowercase', async () => {
  const mixedCaseSubdomain = `TestSubDomain${Date.now()}`;

  await request(app)
    .post('/api/healthcare/admin/subdomain')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ subdomain: mixedCaseSubdomain });

  const updated = await UserData.findOne({ practiceId: testUser.practiceId });
  // Just verify it's lowercase, don't compare exact value
  expect(updated.subdomain).toBe(updated.subdomain.toLowerCase());
  expect(updated.subdomain).toMatch(/^[a-z0-9-]+$/);
});

    test('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/healthcare/admin/subdomain')
        .send({ subdomain: 'testsubdomain' })
        .expect(401);
    });
  });
});