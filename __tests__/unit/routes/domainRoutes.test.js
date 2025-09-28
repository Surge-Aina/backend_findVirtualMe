const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { setupTestDB, teardownTestDB, clearTestDB } = require('../setup.js');
const domainRoutes = require('../../../routes/domainRoutes.js');
const User = require('../../../models/User.js');

// Mock the domain service
jest.mock('../../../services/domainService.js');
const domainService = require('../../../services/domainService.js');

const app = express();
app.use(express.json());
app.use('/api/domains', domainRoutes);

describe('Domain Routes Integration', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  describe('GET /api/domains/check/:domain', () => {
    test('should call getDomain service with correct parameters', async () => {
      domainService.getDomain.mockImplementation((req, res) => {
        res.status(200).json({
          domain: 'testdomain.com',
          available: true,
          isPremium: false
        });
      });

      const response = await request(app)
        .get('/api/domains/check/testdomain.com');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        domain: 'testdomain.com',
        available: true,
        isPremium: false
      });
      expect(domainService.getDomain).toHaveBeenCalledTimes(1);
    });

    test('should handle domain check errors', async () => {
      domainService.getDomain.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Invalid domain name'
        });
      });

      const response = await request(app)
        .get('/api/domains/check/invalid..domain');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid domain name'
      });
    });
  });

  describe('POST /api/domains/register', () => {
    test('should call registerDomain service', async () => {
      domainService.registerDomain.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Domain registration initiated',
          domain: 'newdomain.com',
          portfolioId: 'portfolio123',
          status: 'active'
        });
      });

      const response = await request(app)
        .post('/api/domains/register')
        .send({
          domain: 'newdomain.com',
          portfolioId: 'portfolio123',
          plan: 'annual'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Domain registration initiated',
        domain: 'newdomain.com',
        portfolioId: 'portfolio123',
        status: 'active'
      });
      expect(domainService.registerDomain).toHaveBeenCalledTimes(1);
    });

    test('should handle registration validation errors', async () => {
      domainService.registerDomain.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Domain and portfolioId are required'
        });
      });

      const response = await request(app)
        .post('/api/domains/register')
        .send({
          domain: 'test.com'
          // missing portfolioId
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Domain and portfolioId are required'
      });
    });
  });

  describe('POST /api/domains/custom', () => {
    test('should call configureCustomDomain service', async () => {
      domainService.configureCustomDomain.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Custom domain configured - please verify DNS settings',
          domain: 'mycustom.com',
          portfolioId: 'portfolio456',
          status: 'pending_verification'
        });
      });

      const response = await request(app)
        .post('/api/domains/custom')
        .send({
          domain: 'mycustom.com',
          portfolioId: 'portfolio456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Custom domain configured - please verify DNS settings',
        domain: 'mycustom.com',
        portfolioId: 'portfolio456',
        status: 'pending_verification'
      });
      expect(domainService.configureCustomDomain).toHaveBeenCalledTimes(1);
    });

    test('should handle custom domain validation errors', async () => {
      domainService.configureCustomDomain.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Domain and portfolioId are required'
        });
      });

      const response = await request(app)
        .post('/api/domains/custom')
        .send({
          domain: 'test.com'
          // missing portfolioId
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Domain and portfolioId are required'
      });
    });
  });

  describe('GET /api/domains/user/:userId', () => {
    test('should call getUserDomains service', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      
      domainService.getUserDomains.mockImplementation((req, res) => {
        res.status(200).json({
          domains: [
            {
              domain: 'user1.com',
              portfolioId: 'portfolio123',
              type: 'platform',
              status: 'active'
            }
          ],
          portfolios: ['portfolio123'],
          message: 'User domains retrieved successfully'
        });
      });

      const response = await request(app)
        .get(`/api/domains/user/${mockUserId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        domains: [
          {
            domain: 'user1.com',
            portfolioId: 'portfolio123',
            type: 'platform',
            status: 'active'
          }
        ],
        portfolios: ['portfolio123'],
        message: 'User domains retrieved successfully'
      });
      expect(domainService.getUserDomains).toHaveBeenCalledTimes(1);
    });

    test('should handle user not found errors', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      
      domainService.getUserDomains.mockImplementation((req, res) => {
        res.status(404).json({
          error: 'User not found'
        });
      });

      const response = await request(app)
        .get(`/api/domains/user/${mockUserId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'User not found'
      });
    });
  });

  describe('POST /api/domains/verify/:domain', () => {
    test('should return verification placeholder message', async () => {
      const response = await request(app)
        .post('/api/domains/verify/testdomain.com')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'DNS verification not yet implemented',
        domain: 'testdomain.com'
      });
    });
  });

  describe('Route Parameter Validation', () => {
    test('should handle invalid domain parameter format', async () => {
      domainService.getDomain.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Invalid domain format'
        });
      });

      const response = await request(app)
        .get('/api/domains/check/invalid-domain-format');

      expect(response.status).toBe(400);
    });

    test('should handle invalid userId parameter format', async () => {
      domainService.getUserDomains.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Invalid user ID format'
        });
      });

      const response = await request(app)
        .get('/api/domains/user/invalid-user-id');

      expect(response.status).toBe(400);
    });
  });

  describe('Request Body Validation', () => {
    test('should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/domains/register')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle empty request body', async () => {
      domainService.registerDomain.mockImplementation((req, res) => {
        res.status(400).json({
          error: 'Domain and portfolioId are required'
        });
      });

      const response = await request(app)
        .post('/api/domains/register')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Content-Type Handling', () => {
    test('should handle missing Content-Type header', async () => {
      domainService.registerDomain.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Domain registration initiated'
        });
      });

      const response = await request(app)
        .post('/api/domains/register')
        .send({
          domain: 'test.com',
          portfolioId: 'portfolio123'
        });

      expect(response.status).toBe(200);
    });

    test('should handle application/json Content-Type', async () => {
      domainService.configureCustomDomain.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Custom domain configured'
        });
      });

      const response = await request(app)
        .post('/api/domains/custom')
        .set('Content-Type', 'application/json')
        .send({
          domain: 'custom.com',
          portfolioId: 'portfolio456'
        });

      expect(response.status).toBe(200);
    });
  });
});
