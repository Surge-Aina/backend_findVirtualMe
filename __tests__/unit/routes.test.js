const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup.js');
const settingsRoutes = require('../../routes/settingsRoute.js');
const userRoutes = require('../../routes/userRoute.js');
const User = require('../../models/userModel.js');
const Settings = require('../../models/settingsModel.js');
const bcrypt = require('bcrypt');

// Create test app
const app = express();
app.use(cors());
app.use(express.json());

// Set up test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.NODE_ENV = 'test';

app.use('/settings', settingsRoutes);
app.use('/user', userRoutes);

describe('API Routes Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('Settings Routes', () => {
    describe('GET /settings/:key', () => {
      test('should get a specific setting', async () => {
        await Settings.create({
          key: 'heroText',
          value: 'Welcome to our photography portfolio'
        });

        const response = await request(app)
          .get('/settings/heroText')
          .expect(200);

        expect(response.body).toEqual({
          key: 'heroText',
          value: 'Welcome to our photography portfolio'
        });
      });

      test('should return 404 for non-existent setting', async () => {
        const response = await request(app)
          .get('/settings/nonExistent')
          .expect(404);

        expect(response.body.error).toBe('Setting not found');
      });
    });

    describe('PUT /settings/:key', () => {
      test('should create a new setting', async () => {
        const settingData = {
          value: {
            title: 'About Us',
            description: 'We are professional photographers'
          }
        };

        const response = await request(app)
          .put('/settings/aboutData')
          .send(settingData)
          .expect(200);

        expect(response.body.key).toBe('aboutData');
        expect(response.body.value).toEqual(settingData.value);
      });

      test('should update existing setting', async () => {
        await Settings.create({
          key: 'contactEmail',
          value: 'old@example.com'
        });

        const response = await request(app)
          .put('/settings/contactEmail')
          .send({ value: 'new@example.com' })
          .expect(200);

        expect(response.body.value).toBe('new@example.com');
      });

      test('should handle complex data structures', async () => {
        const complexData = {
          services: [
            { title: 'Wedding', price: 1000 },
            { title: 'Portrait', price: 500 }
          ],
          packages: {
            basic: { hours: 2, photos: 50 },
            premium: { hours: 4, photos: 100 }
          }
        };

        const response = await request(app)
          .put('/settings/servicesData')
          .send({ value: complexData })
          .expect(200);

        expect(response.body.value).toEqual(complexData);
      });
    });

    describe('GET /settings', () => {
      test('should return all settings', async () => {
        await Settings.create([
          { key: 'setting1', value: 'value1' },
          { key: 'setting2', value: { nested: 'object' } },
          { key: 'setting3', value: ['array', 'data'] }
        ]);

        const response = await request(app)
          .get('/settings')
          .expect(200);

        expect(response.body).toEqual({
          setting1: 'value1',
          setting2: { nested: 'object' },
          setting3: ['array', 'data']
        });
      });
    });
  });

  describe('User Routes', () => {
    describe('POST /user/login', () => {
      test('should login admin user successfully', async () => {
        const password = 'adminPassword123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await User.create({
          email: 'admin@example.com',
          password: hashedPassword,
          isAdmin: true
        });

        const response = await request(app)
          .post('/user/login')
          .send({
            email: 'admin@example.com',
            password: password
          })
          .expect(201);

        expect(response.body).toHaveProperty('token');
        expect(response.body.isAdmin).toBe(true);
      });

      test('should login regular user successfully', async () => {
        const password = 'userPassword123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await User.create({
          email: 'user@example.com',
          password: hashedPassword,
          isAdmin: false
        });

        const response = await request(app)
          .post('/user/login')
          .send({
            email: 'user@example.com',
            password: password
          })
          .expect(201);

        expect(response.body).toHaveProperty('token');
        expect(response.body.isAdmin).toBe(false);
      });

      test('should reject invalid credentials', async () => {
        const password = 'correctPassword';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await User.create({
          email: 'test@example.com',
          password: hashedPassword,
          isAdmin: false
        });

        const response = await request(app)
          .post('/user/login')
          .send({
            email: 'test@example.com',
            password: 'wrongPassword'
          })
          .expect(400);

        expect(response.body.message).toBe('Invalid credentials');
      });

      test('should reject non-existent user', async () => {
        const response = await request(app)
          .post('/user/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          })
          .expect(400);

        expect(response.body.message).toBe('User not found');
      });
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle complete portfolio setup workflow', async () => {
      // 1. Create admin user
      const adminPassword = 'adminPass123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: 'admin@portfolio.com',
        password: hashedPassword,
        isAdmin: true
      });

      // 2. Login as admin
      const loginResponse = await request(app)
        .post('/user/login')
        .send({
          email: 'admin@portfolio.com',
          password: adminPassword
        })
        .expect(201);

      expect(loginResponse.body.isAdmin).toBe(true);

      // 3. Set up hero text
      await request(app)
        .put('/settings/heroText')
        .send({ value: 'Professional Photography Services' })
        .expect(200);

      // 4. Set up services
      const servicesData = [
        { title: 'Weddings', description: 'Beautiful wedding photography' },
        { title: 'Portraits', description: 'Professional portrait sessions' }
      ];

      await request(app)
        .put('/settings/servicesData')
        .send({ value: servicesData })
        .expect(200);

      // 5. Set up contact info
      await request(app)
        .put('/settings/contactEmail')
        .send({ value: 'contact@portfolio.com' })
        .expect(200);

      await request(app)
        .put('/settings/contactPhone')
        .send({ value: '(555) 123-4567' })
        .expect(200);

      // 6. Verify all settings were saved
      const allSettingsResponse = await request(app)
        .get('/settings')
        .expect(200);

      expect(allSettingsResponse.body).toMatchObject({
        heroText: 'Professional Photography Services',
        servicesData: servicesData,
        contactEmail: 'contact@portfolio.com',
        contactPhone: '(555) 123-4567'
      });
    });

    test('should handle multiple user types', async () => {
      // Create multiple users
      const users = [
        { email: 'admin@test.com', password: 'admin123', isAdmin: true },
        { email: 'editor@test.com', password: 'editor123', isAdmin: false },
        { email: 'viewer@test.com', password: 'viewer123', isAdmin: false }
      ];

      for (const userData of users) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await User.create({
          email: userData.email,
          password: hashedPassword,
          isAdmin: userData.isAdmin
        });
      }

      // Test login for each user type
      for (const userData of users) {
        const response = await request(app)
          .post('/user/login')
          .send({
            email: userData.email,
            password: userData.password
          })
          .expect(201);

        expect(response.body.isAdmin).toBe(userData.isAdmin);
        expect(response.body).toHaveProperty('token');
      }
    });

    test('should handle concurrent setting updates', async () => {
      const settingKey = 'concurrentTest';
      const initialValue = 'initial';

      // Create initial setting
      await request(app)
        .put(`/settings/${settingKey}`)
        .send({ value: initialValue })
        .expect(200);

      // Simulate concurrent updates
      const updates = [
        'update1',
        'update2', 
        'update3',
        'update4',
        'update5'
      ];

      const promises = updates.map(value => 
        request(app)
          .put(`/settings/${settingKey}`)
          .send({ value })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Final value should be one of the updates
      const finalResponse = await request(app)
        .get(`/settings/${settingKey}`)
        .expect(200);

      expect(updates).toContain(finalResponse.body.value);
    });
  });
});
