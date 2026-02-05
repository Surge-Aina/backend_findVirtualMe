const mongoose = require('mongoose');
const QuoteRequest = require('../../models/cleaningLady/QuoteRequest');

describe('QuoteRequest Model Tests', () => {
  const validQuoteData = {
    portfolioId: new mongoose.Types.ObjectId(),
    services: ['Deep Cleaning', 'Window Cleaning'],
    dueDate: new Date('2024-12-01'),
    name: 'John Doe',
    email: 'john@test.com',
    phone: '123-456-7890'
  };

  describe('Required Fields', () => {
    it('should create a valid quote request', () => {
      const quote = new QuoteRequest(validQuoteData);
      const error = quote.validateSync();
      
      expect(error).toBeUndefined();
    });

    it('should require portfolioId', () => {
      const quoteData = { ...validQuoteData };
      delete quoteData.portfolioId;
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.portfolioId).toBeDefined();
    });

    it('should require dueDate', () => {
      const quoteData = { ...validQuoteData };
      delete quoteData.dueDate;
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.dueDate).toBeDefined();
    });

    it('should require name', () => {
      const quoteData = { ...validQuoteData };
      delete quoteData.name;
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    it('should require email', () => {
      const quoteData = { ...validQuoteData };
      delete quoteData.email;
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should require phone', () => {
      const quoteData = { ...validQuoteData };
      delete quoteData.phone;
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.phone).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should set status to new by default', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.status).toBe('new');
    });

    it('should set details to empty string by default', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.details).toBe('');
    });
  });

  describe('Services Array', () => {
    it('should store array of services', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(Array.isArray(quote.services)).toBe(true);
      expect(quote.services).toHaveLength(2);
      expect(quote.services[0]).toBe('Deep Cleaning');
    });

    it('should allow empty services array', () => {
      const quoteData = {
        ...validQuoteData,
        services: []
      };
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeUndefined();
      expect(quote.services).toHaveLength(0);
    });

    it('should allow single service', () => {
      const quoteData = {
        ...validQuoteData,
        services: ['Basic Cleaning']
      };
      
      const quote = new QuoteRequest(quoteData);
      
      expect(quote.services).toHaveLength(1);
      expect(quote.services[0]).toBe('Basic Cleaning');
    });
  });

  describe('Status Enum', () => {
    it('should accept valid status values', () => {
      const statuses = ['new', 'in_progress', 'completed', 'rejected'];
      
      statuses.forEach(status => {
        const quoteData = { ...validQuoteData, status };
        const quote = new QuoteRequest(quoteData);
        const error = quote.validateSync();
        
        expect(error).toBeUndefined();
        expect(quote.status).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      const quoteData = {
        ...validQuoteData,
        status: 'invalid_status'
      };
      
      const quote = new QuoteRequest(quoteData);
      const error = quote.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });
  });

  describe('Details Field', () => {
    it('should allow custom details', () => {
      const quoteData = {
        ...validQuoteData,
        details: 'Need cleaning for 3-bedroom house'
      };
      
      const quote = new QuoteRequest(quoteData);
      
      expect(quote.details).toBe('Need cleaning for 3-bedroom house');
    });

    it('should allow long details text', () => {
      const longText = 'A'.repeat(500);
      const quoteData = {
        ...validQuoteData,
        details: longText
      };
      
      const quote = new QuoteRequest(quoteData);
      
      expect(quote.details).toBe(longText);
      expect(quote.details.length).toBe(500);
    });
  });

  describe('Contact Information', () => {
    it('should store customer name', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.name).toBe('John Doe');
    });

    it('should store customer email', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.email).toBe('john@test.com');
    });

    it('should store customer phone', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.phone).toBe('123-456-7890');
    });
  });

  describe('Due Date', () => {
    it('should store due date as Date object', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.dueDate).toBeInstanceOf(Date);
    });

    it('should accept string date and convert to Date', () => {
      const quoteData = {
        ...validQuoteData,
        dueDate: '2024-12-25'
      };
      
      const quote = new QuoteRequest(quoteData);
      
      expect(quote.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('Portfolio Reference', () => {
    it('should store portfolioId as ObjectId', () => {
      const quote = new QuoteRequest(validQuoteData);
      
      expect(quote.portfolioId).toBeInstanceOf(mongoose.Types.ObjectId);
    });
  });

  
});