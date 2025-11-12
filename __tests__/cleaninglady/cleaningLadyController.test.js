const {
  getAllPortfolios,
  getPublicPortfolio,
  getMyPortfolio,
  getPortfolioById,
  savePortfolio,
  updateMyPortfolio,
  publishPortfolio,
  unpublishPortfolio,
  addService,
  updateService,
  deleteService,
  updateRoomPricing,
  submitQuote,
  getMyQuotes,
  updateQuoteStatus
} = require('../../controllers/cleaningLady/portfolioController');

const Portfolio = require('../../models/cleaningLady/Portfolio');
const User = require('../../models/User');
const QuoteRequest = require('../../models/cleaningLady/QuoteRequest');
const { sendQuoteEmails } = require('../../services/emailService');

// Mock all the dependencies
jest.mock('../../models/cleaningLady/Portfolio');
jest.mock('../../models/User');
jest.mock('../../models/cleaningLady/QuoteRequest');
jest.mock('../../services/emailService');

describe('Cleaning Lady Controller Tests', () => {
  let req, res;

  // This runs before each test - sets up fresh req and res objects
  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id: 'user123' },
      headers: {}
    };
    
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // =============================================
  // PUBLIC ENDPOINTS TESTS
  // =============================================

  describe('getAllPortfolios', () => {
    it('should return all portfolios with email fields', async () => {
      const mockPortfolios = [
        {
          _id: 'portfolio1',
          businessName: 'Clean Co',
          userId: { email: 'owner@test.com', _id: 'user1' },
          toObject: function() { return { ...this }; }
        }
      ];

      Portfolio.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPortfolios)
      });

      await getAllPortfolios(req, res);

      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'owner@test.com',
            userEmail: 'owner@test.com',
            ownerEmail: 'owner@test.com'
          })
        ])
      );
    });

    it('should handle errors when fetching portfolios', async () => {
      Portfolio.find.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await getAllPortfolios(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching portfolios' });
    });
  });

  describe('getPublicPortfolio', () => {
    it('should return a published portfolio by slug', async () => {
      req.params.slug = 'my-cleaning-service';
      const mockPortfolio = {
        _id: 'portfolio1',
        slug: 'my-cleaning-service',
        isPublished: true,
        businessName: 'My Cleaning'
      };

      Portfolio.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPortfolio)
      });

      await getPublicPortfolio(req, res);

      expect(res.json).toHaveBeenCalledWith({
        portfolio: mockPortfolio,
        isOwner: false
      });
    });

    it('should return 404 if portfolio not found', async () => {
      req.params.slug = 'nonexistent';
      Portfolio.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await getPublicPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Portfolio not found' });
    });

    it('should handle server errors', async () => {
      req.params.slug = 'test';
      Portfolio.findOne.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await getPublicPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('getMyPortfolio', () => {
    it('should return existing portfolio for logged-in user', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        userId: 'user123',
        businessName: 'My Business'
      };

      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      await getMyPortfolio(req, res);

      expect(Portfolio.findOne).toHaveBeenCalledWith({ userId: 'user123' });
      expect(res.json).toHaveBeenCalledWith({
        portfolio: mockPortfolio,
        isOwner: true
      });
    });

    it('should create default portfolio if none exists', async () => {
      Portfolio.findOne.mockResolvedValue(null);
      
      const mockNewPortfolio = {
        _id: 'newportfolio',
        userId: 'user123',
        slug: 'user-cleaning-123',
        businessName: 'My Cleaning Service'
      };

      Portfolio.create.mockResolvedValue(mockNewPortfolio);
      User.findByIdAndUpdate.mockResolvedValue({});

      await getMyPortfolio(req, res);

      expect(Portfolio.create).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $addToSet: { portfolios: 'newportfolio' } }
      );
      expect(res.json).toHaveBeenCalledWith({
        portfolio: mockNewPortfolio,
        isOwner: true
      });
    });

    it('should handle errors', async () => {
      Portfolio.findOne.mockRejectedValue(new Error('DB Error'));

      await getMyPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('getPortfolioById', () => {
    it('should return portfolio with isOwner false when no token', async () => {
      req.params.portfolioId = 'portfolio1';
      const mockPortfolio = {
        _id: 'portfolio1',
        userId: 'user123',
        businessName: 'Test Portfolio'
      };

      Portfolio.findById.mockResolvedValue(mockPortfolio);

      await getPortfolioById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        portfolio: mockPortfolio,
        isOwner: false
      });
    });

    it('should return 404 if portfolio not found', async () => {
      req.params.portfolioId = 'nonexistent';
      Portfolio.findById.mockResolvedValue(null);

      await getPortfolioById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Portfolio not found' });
    });

    it('should handle errors', async () => {
      req.params.portfolioId = 'portfolio1';
      Portfolio.findById.mockRejectedValue(new Error('DB Error'));

      await getPortfolioById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  // =============================================
  // PROTECTED ENDPOINTS TESTS
  // =============================================

  describe('savePortfolio', () => {
    it('should update existing portfolio', async () => {
      const mockUser = { _id: 'user123', email: 'test@test.com' };
      const mockPortfolio = {
        _id: 'portfolio1',
        userId: 'user123',
        businessName: 'Old Name',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.body = {
        businessName: 'New Name',
        tagline: 'New tagline'
      };

      await savePortfolio(req, res);

      expect(mockPortfolio.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio updated successfully',
        portfolio: mockPortfolio
      });
    });

    it('should create new portfolio if none exists', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(null);

      const mockNewPortfolio = {
        _id: 'newportfolio',
        userId: 'user123',
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock the Portfolio constructor
      Portfolio.mockImplementation(() => mockNewPortfolio);
      User.findByIdAndUpdate.mockResolvedValue({});

      req.body = {
        slug: 'my-slug',
        businessName: 'New Business'
      };

      await savePortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio created successfully',
        portfolio: mockNewPortfolio
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await savePortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should handle duplicate slug error', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(null);

      const mockPortfolio = {
        save: jest.fn().mockRejectedValue({ code: 11000 })
      };
      Portfolio.mockImplementation(() => mockPortfolio);

      await savePortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Slug already taken. Please choose a different one.'
      });
    });

    it('should handle general errors', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockRejectedValue(new Error('DB Error'));

      await savePortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error saving portfolio' });
    });
  });

  describe('updateMyPortfolio', () => {
    it('should update portfolio successfully', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        businessName: 'Updated Name'
      };

      Portfolio.findOneAndUpdate.mockResolvedValue(mockPortfolio);

      req.body = { businessName: 'Updated Name', tagline: 'New tagline' };

      await updateMyPortfolio(req, res);

      expect(Portfolio.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user123' },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio updated successfully',
        portfolio: mockPortfolio
      });
    });

    it('should return 404 if portfolio not found', async () => {
      Portfolio.findOneAndUpdate.mockResolvedValue(null);

      await updateMyPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Portfolio not found' });
    });

    it('should handle errors', async () => {
      Portfolio.findOneAndUpdate.mockRejectedValue(new Error('DB Error'));

      await updateMyPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('publishPortfolio', () => {
    it('should publish portfolio successfully', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        _id: 'portfolio1',
        slug: 'my-portfolio',
        isPublished: true
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOneAndUpdate.mockResolvedValue(mockPortfolio);

      await publishPortfolio(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio published successfully!',
        portfolio: mockPortfolio,
        publicUrl: '/portfolio/my-portfolio'
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await publishPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if portfolio not found', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOneAndUpdate.mockResolvedValue(null);

      await publishPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Portfolio not found' });
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await publishPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error publishing portfolio' });
    });
  });

  describe('unpublishPortfolio', () => {
    it('should unpublish portfolio successfully', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        _id: 'portfolio1',
        slug: 'my-portfolio',
        isPublished: false
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOneAndUpdate.mockResolvedValue(mockPortfolio);

      await unpublishPortfolio(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio unpublished',
        portfolio: mockPortfolio
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await unpublishPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await unpublishPortfolio(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error unpublishing portfolio' });
    });
  });

  // =============================================
  // SERVICES MANAGEMENT TESTS
  // =============================================

  describe('addService', () => {
    it('should add service to portfolio', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        _id: 'portfolio1',
        services: [],
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.body = {
        title: 'Deep Cleaning',
        description: 'Thorough cleaning',
        price: 100,
        icon: 'clean-icon'
      };

      await addService(req, res);

      expect(mockPortfolio.services).toHaveLength(1);
      expect(mockPortfolio.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Service added successfully',
        services: mockPortfolio.services
      });
    });

    it('should return 400 if required fields missing', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue({});

      req.body = { price: 100 }; // Missing title and description

      await addService(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Title and description are required'
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await addService(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if portfolio not found', async () => {
      const mockUser = { _id: 'user123' };
      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(null);

      req.body = {
        title: 'Service',
        description: 'Description'
      };

      await addService(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Portfolio not found. Create a portfolio first.'
      });
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await addService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error adding service' });
    });
  });

  describe('updateService', () => {
    it('should update service successfully', async () => {
      const mockUser = { _id: 'user123' };
      const mockService = {
        _id: 'service1',
        title: 'Old Title'
      };
      const mockPortfolio = {
        _id: 'portfolio1',
        services: {
          id: jest.fn().mockReturnValue(mockService)
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.params.serviceId = 'service1';
      req.body = { title: 'New Title' };

      await updateService(req, res);

      expect(mockPortfolio.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Service updated successfully',
        service: mockService
      });
    });

    it('should return 404 if service not found', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        services: {
          id: jest.fn().mockReturnValue(null)
        }
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.params.serviceId = 'nonexistent';

      await updateService(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Service not found' });
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await updateService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error updating service' });
    });
  });

  describe('deleteService', () => {
    it('should delete service successfully', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        _id: 'portfolio1',
        services: {
          pull: jest.fn()
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.params.serviceId = 'service1';

      await deleteService(req, res);

      expect(mockPortfolio.services.pull).toHaveBeenCalledWith('service1');
      expect(mockPortfolio.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Service deleted successfully',
        services: mockPortfolio.services
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await deleteService(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await deleteService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error deleting service' });
    });
  });

  // =============================================
  // ROOM PRICING MANAGEMENT TESTS
  // =============================================

  describe('updateRoomPricing', () => {
    it('should update room pricing successfully', async () => {
      const mockUser = { _id: 'user123' };
      const mockPortfolio = {
        _id: 'portfolio1',
        roomPricing: [],
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      Portfolio.findOne.mockResolvedValue(mockPortfolio);

      req.body = {
        roomPricing: [
          { rooms: 1, price: 50 },
          { rooms: 2, price: 75 }
        ]
      };

      await updateRoomPricing(req, res);

      expect(mockPortfolio.roomPricing).toEqual(req.body.roomPricing);
      expect(mockPortfolio.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Room pricing updated successfully',
        roomPricing: req.body.roomPricing
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await updateRoomPricing(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      User.findById.mockRejectedValue(new Error('DB Error'));

      await updateRoomPricing(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error updating room pricing' });
    });
  });

  // =============================================
  // QUOTES MANAGEMENT TESTS
  // =============================================

  describe('submitQuote', () => {
    it('should submit quote and send emails', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        businessName: 'Clean Co',
        userId: { email: 'owner@test.com' }
      };

      const mockQuote = {
        _id: 'quote1',
        name: 'John Doe',
        email: 'john@test.com'
      };

      Portfolio.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPortfolio)
      });
      QuoteRequest.create.mockResolvedValue(mockQuote);
      sendQuoteEmails.mockResolvedValue(true);

      req.body = {
        portfolioId: 'portfolio1',
        services: ['cleaning'],
        details: 'Need deep cleaning',
        dueDate: '2024-12-01',
        name: 'John Doe',
        email: 'john@test.com',
        phone: '1234567890'
      };

      await submitQuote(req, res);

      expect(QuoteRequest.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quote request submitted successfully',
        quote: mockQuote
      });
    });

    it('should handle empty services array', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        businessName: 'Clean Co',
        userId: { email: 'owner@test.com' }
      };

      const mockQuote = {
        _id: 'quote1',
        name: 'John Doe'
      };

      Portfolio.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPortfolio)
      });
      QuoteRequest.create.mockResolvedValue(mockQuote);

      req.body = {
        portfolioId: 'portfolio1',
        services: [],
        name: 'John Doe',
        email: 'john@test.com',
        phone: '1234567890',
        dueDate: '2024-12-01'
      };

      await submitQuote(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if services is not an array', async () => {
      req.body = {
        services: 'not-an-array',
        name: 'John',
        email: 'john@test.com',
        phone: '123',
        dueDate: '2024-12-01'
      };

      await submitQuote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Services must be an array'
      });
    });

    it('should return 400 if required fields missing', async () => {
      req.body = {
        services: ['cleaning']
        // Missing other required fields
      };

      await submitQuote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All contact fields are required'
      });
    });

    it('should return 404 if portfolio not found', async () => {
      Portfolio.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      req.body = {
        portfolioId: 'nonexistent',
        services: [],
        name: 'John',
        email: 'john@test.com',
        phone: '123',
        dueDate: '2024-12-01'
      };

      await submitQuote(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      Portfolio.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      req.body = {
        portfolioId: 'portfolio1',
        services: [],
        name: 'John',
        email: 'john@test.com',
        phone: '123',
        dueDate: '2024-12-01'
      };

      await submitQuote(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('getMyQuotes', () => {
    it('should return all quotes for user portfolio', async () => {
      const mockPortfolio = { _id: 'portfolio1' };
      const mockQuotes = [
        { _id: 'quote1', name: 'John' },
        { _id: 'quote2', name: 'Jane' }
      ];

      Portfolio.findOne.mockResolvedValue(mockPortfolio);
      QuoteRequest.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockQuotes)
      });

      await getMyQuotes(req, res);

      expect(res.json).toHaveBeenCalledWith(mockQuotes);
    });

    it('should return 404 if portfolio not found', async () => {
      Portfolio.findOne.mockResolvedValue(null);

      await getMyQuotes(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      Portfolio.findOne.mockRejectedValue(new Error('DB Error'));

      await getMyQuotes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('updateQuoteStatus', () => {
    it('should update quote status successfully', async () => {
      req.params.quoteId = 'quote1';
      req.body.status = 'accepted';

      const mockPortfolio = { _id: 'portfolio1' };
      const mockQuote = {
        _id: 'quote1',
        status: 'new',
        save: jest.fn().mockResolvedValue(true)
      };

      Portfolio.findOne.mockResolvedValue(mockPortfolio);
      QuoteRequest.findOne.mockResolvedValue(mockQuote);

      await updateQuoteStatus(req, res);

      expect(mockQuote.status).toBe('accepted');
      expect(mockQuote.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quote status updated',
        quote: mockQuote
      });
    });

    it('should return 404 if portfolio not found', async () => {
      req.params.quoteId = 'quote1';
      req.body.status = 'accepted';

      Portfolio.findOne.mockResolvedValue(null);

      await updateQuoteStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Portfolio not found' });
    });

    it('should return 404 if quote not found', async () => {
      req.params.quoteId = 'nonexistent';
      req.body.status = 'accepted';

      const mockPortfolio = { _id: 'portfolio1' };
      Portfolio.findOne.mockResolvedValue(mockPortfolio);
      QuoteRequest.findOne.mockResolvedValue(null);

      await updateQuoteStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Quote not found' });
    });

    it('should handle errors', async () => {
      req.params.quoteId = 'quote1';
      req.body.status = 'accepted';

      Portfolio.findOne.mockRejectedValue(new Error('DB Error'));

      await updateQuoteStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });
});