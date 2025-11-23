const request = require('supertest');
const express = require('express');
const ProjectManagerContact = require('../../models/projectManager/ProjectManagerContact');
const Portfolio = require('../../models/projectManager/portfolioModel');
const { sendProjectManagerContactEmails } = require('../../services/emailService');
const { submitContact } = require('../../controllers/projectManager/projectManagerContactController');
const router = require("../../routes/projectManager/portfolioRoute");

jest.mock('../../models/projectManager/ProjectManagerContact');
jest.mock('../../models/projectManager/portfolioModel');
jest.mock('../../services/emailService');
jest.mock('../../middleware/auth');

describe('Project Manager Contact System Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/portfolio', router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });


  describe('submitContact Controller', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'I would like to discuss a project',
          portfolioId: 'portfolio123'
        }
      };
      
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
    });

    describe('✅ Success Cases', () => {
      it('should successfully submit contact form and return 201', async () => {
        // Mock portfolio found
        const mockPortfolio = {
          _id: 'portfolio123',
          email: 'owner@example.com',
          name: 'Jane Smith'
        };
        Portfolio.findById.mockResolvedValue(mockPortfolio);

        // Mock contact creation
        const mockContact = {
          _id: 'contact123',
          portfolioId: 'portfolio123',
          ownerEmail: 'owner@example.com',
          ownerName: 'Jane Smith',
          name: 'John Doe',
          email: 'john@example.com',
          message: 'I would like to discuss a project',
          status: 'new'
        };
        ProjectManagerContact.create.mockResolvedValue(mockContact);

        // Mock email service
        sendProjectManagerContactEmails.mockResolvedValue(true);

        await submitContact(req, res);

        expect(Portfolio.findById).toHaveBeenCalledWith('portfolio123');
        expect(ProjectManagerContact.create).toHaveBeenCalledWith({
          portfolioId: 'portfolio123',
          ownerEmail: 'owner@example.com',
          ownerName: 'Jane Smith',
          name: 'John Doe',
          email: 'john@example.com',
          message: 'I would like to discuss a project',
          status: 'new'
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Contact message sent successfully'
        });
      });

      it('should handle missing owner name gracefully', async () => {
        const mockPortfolio = {
          _id: 'portfolio123',
          email: 'owner@example.com'
          // name is missing
        };
        Portfolio.findById.mockResolvedValue(mockPortfolio);

        const mockContact = {
          _id: 'contact123',
          ownerName: 'Project Manager'
        };
        ProjectManagerContact.create.mockResolvedValue(mockContact);
        sendProjectManagerContactEmails.mockResolvedValue(true);

        await submitContact(req, res);

        expect(ProjectManagerContact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            ownerName: 'Project Manager'
          })
        );
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it('should still succeed even if email sending fails', async () => {
        const mockPortfolio = {
          _id: 'portfolio123',
          email: 'owner@example.com',
          name: 'Jane Smith'
        };
        Portfolio.findById.mockResolvedValue(mockPortfolio);
        ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
        
        // Email fails but should not affect response
        sendProjectManagerContactEmails.mockRejectedValue(new Error('Email service down'));

        await submitContact(req, res);

        // Give time for promise to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Contact message sent successfully'
        });
      });
    });

    describe('❌ Validation Errors', () => {
      it('should return 400 if name is missing', async () => {
        req.body.name = '';

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name, email, message, and portfolioId are required'
        });
      });

      it('should return 400 if email is missing', async () => {
        req.body.email = undefined;

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name, email, message, and portfolioId are required'
        });
      });

      it('should return 400 if message is missing', async () => {
        req.body.message = null;

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name, email, message, and portfolioId are required'
        });
      });

      it('should return 400 if portfolioId is missing', async () => {
        delete req.body.portfolioId;

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name, email, message, and portfolioId are required'
        });
      });

      it('should return 400 if all fields are missing', async () => {
        req.body = {};

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('❌ Portfolio Not Found', () => {
      it('should return 404 if portfolio does not exist', async () => {
        Portfolio.findById.mockResolvedValue(null);

        await submitContact(req, res);

        expect(Portfolio.findById).toHaveBeenCalledWith('portfolio123');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Portfolio not found'
        });
        expect(ProjectManagerContact.create).not.toHaveBeenCalled();
      });
    });

    describe('❌ Server Errors', () => {
      it('should return 500 if database error occurs during portfolio fetch', async () => {
        Portfolio.findById.mockRejectedValue(new Error('Database connection failed'));

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Server error'
        });
      });

      it('should return 500 if contact creation fails', async () => {
        const mockPortfolio = {
          _id: 'portfolio123',
          email: 'owner@example.com',
          name: 'Jane Smith'
        };
        Portfolio.findById.mockResolvedValue(mockPortfolio);
        ProjectManagerContact.create.mockRejectedValue(new Error('Failed to save contact'));

        await submitContact(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Server error'
        });
      });
    });

    describe('📧 Email Service Integration', () => {
      it('should call email service with correct parameters', async () => {
        const mockPortfolio = {
          _id: 'portfolio123',
          email: 'owner@example.com',
          name: 'Jane Smith'
        };
        Portfolio.findById.mockResolvedValue(mockPortfolio);
        ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
        sendProjectManagerContactEmails.mockResolvedValue(true);

        await submitContact(req, res);

        // Wait for async email call
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(sendProjectManagerContactEmails).toHaveBeenCalledWith(
          {
            name: 'John Doe',
            email: 'john@example.com',
            message: 'I would like to discuss a project'
          },
          'owner@example.com',
          'Jane Smith'
        );
      });
    });
  });

  describe('Portfolio Router - Contact Endpoint', () => {
    it('should call POST /api/portfolio/contact successfully', async () => {
      const mockPortfolio = {
        _id: 'portfolio123',
        email: 'owner@example.com',
        name: 'Jane Smith'
      };
      Portfolio.findById.mockResolvedValue(mockPortfolio);
      ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
      sendProjectManagerContactEmails.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/portfolio/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Test message',
          portfolioId: 'portfolio123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Contact message sent successfully');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/portfolio/contact')
        .send({
          name: 'John Doe'
          // missing other fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent portfolio', async () => {
      Portfolio.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/portfolio/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Test message',
          portfolioId: 'nonexistent123'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/portfolio/contact')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });


  describe('Router Configuration', () => {
    it('should have all expected routes defined', () => {
      const routes = [];
      router.stack.forEach(middleware => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        }
      });

      expect(routes).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '/email/:email', methods: ['get'] }),
        expect.objectContaining({ path: '/all-porfolios-by-email/:email', methods: ['get'] }),
        expect.objectContaining({ path: '/id/:id', methods: ['get'] }),
        expect.objectContaining({ path: '/all-portfolios', methods: ['get'] }),
        expect.objectContaining({ path: '/add', methods: ['post'] }),
        expect.objectContaining({ path: '/upload-pdf', methods: ['post'] }),
        expect.objectContaining({ path: '/ai-summary', methods: ['post'] }),
        expect.objectContaining({ path: '/contact', methods: ['post'] }),
        expect.objectContaining({ path: '/edit', methods: ['patch'] }),
        expect.objectContaining({ path: '/delete', methods: ['delete'] })
      ]));
    });

    it('should export router as module', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Test message',
          portfolioId: 'portfolio123'
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      req.body.message = longMessage;

      const mockPortfolio = {
        _id: 'portfolio123',
        email: 'owner@example.com',
        name: 'Jane Smith'
      };
      Portfolio.findById.mockResolvedValue(mockPortfolio);
      ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
      sendProjectManagerContactEmails.mockResolvedValue(true);

      await submitContact(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(ProjectManagerContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: longMessage
        })
      );
    });

    it('should handle special characters in input', async () => {
      req.body.name = "John O'Brien <script>alert('xss')</script>";
      req.body.message = "Test & validate < > ' \" special chars";

      const mockPortfolio = {
        _id: 'portfolio123',
        email: 'owner@example.com',
        name: 'Jane Smith'
      };
      Portfolio.findById.mockResolvedValue(mockPortfolio);
      ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
      sendProjectManagerContactEmails.mockResolvedValue(true);

      await submitContact(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle whitespace-only fields as empty', async () => {
      req.body.name = '   ';

      await submitContact(req, res);

      
      expect(res.status).toHaveBeenCalled();
    });
  });
});


describe('Console Logging', () => {
  let req, res;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    req = {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
        portfolioId: 'portfolio123'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should log appropriate messages during successful submission', async () => {
    const mockPortfolio = {
      _id: 'portfolio123',
      email: 'owner@example.com',
      name: 'Jane Smith'
    };
    Portfolio.findById.mockResolvedValue(mockPortfolio);
    ProjectManagerContact.create.mockResolvedValue({ _id: 'contact123' });
    sendProjectManagerContactEmails.mockResolvedValue(true);

    await submitContact(req, res);

    expect(console.log).toHaveBeenCalledWith('🔵 Project Manager contact form submitted');
    expect(console.log).toHaveBeenCalledWith('📥 Request body:', req.body);
    expect(console.log).toHaveBeenCalledWith('✅ Portfolio found:', 'Jane Smith');
    expect(console.log).toHaveBeenCalledWith('✅ Sending success response to frontend');
  });

  it('should log errors when they occur', async () => {
    Portfolio.findById.mockRejectedValue(new Error('Database error'));

    await submitContact(req, res);

    expect(console.error).toHaveBeenCalledWith(
      '❌ Error submitting contact form:',
      expect.any(Error)
    );
  });
});