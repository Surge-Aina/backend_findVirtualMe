const mongoose = require('mongoose');
const Portfolio = require('../../models/cleaningLady/Portfolio');

describe('Portfolio Model - Complete Branch Coverage', () => {
  
  const validPortfolioData = {
    userId: new mongoose.Types.ObjectId(),
    slug: 'test-cleaning-service'
  };

  describe('Required Fields Validation', () => {
    it('should pass validation with required fields', () => {
      const portfolio = new Portfolio(validPortfolioData);
      const error = portfolio.validateSync();
      expect(error).toBeUndefined();
    });

    it('should fail validation without userId', () => {
      const portfolio = new Portfolio({ slug: 'test' });
      const error = portfolio.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.userId).toBeDefined();
    });

    it('should fail validation without slug', () => {
      const portfolio = new Portfolio({ userId: new mongoose.Types.ObjectId() });
      const error = portfolio.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });
  });

  // CRITICAL: Test BOTH branches for EVERY field with a default value
  
  describe('templateType branches', () => {
    it('should use default when not provided', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.templateType).toBe('cleaning-service');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, templateType: 'custom' });
      expect(portfolio.templateType).toBe('custom');
    });
  });

  describe('isPublished branches', () => {
    it('should default to false', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.isPublished).toBe(false);
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, isPublished: true });
      expect(portfolio.isPublished).toBe(true);
    });
  });

  describe('businessName branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.businessName).toBe('My Cleaning Service');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, businessName: 'Custom Business' });
      expect(portfolio.businessName).toBe('Custom Business');
    });
  });

  describe('tagline branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.tagline).toBe('Professional cleaning for your home');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, tagline: 'Custom tagline' });
      expect(portfolio.tagline).toBe('Custom tagline');
    });
  });

  describe('tagline1 branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.tagline1).toBe('We bring sparkle to your space.');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, tagline1: 'Custom 1' });
      expect(portfolio.tagline1).toBe('Custom 1');
    });
  });

  describe('tagline2 branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.tagline2).toBe('From roof to floor – Every detail matters.');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, tagline2: 'Custom 2' });
      expect(portfolio.tagline2).toBe('Custom 2');
    });
  });

  describe('tagline3 branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.tagline3).toBe('For those I love – My purpose in every sweep.');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, tagline3: 'Custom 3' });
      expect(portfolio.tagline3).toBe('Custom 3');
    });
  });

  describe('buildRoomsTitle branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.buildRoomsTitle).toBe('Build Your Rooms');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, buildRoomsTitle: 'Custom Title' });
      expect(portfolio.buildRoomsTitle).toBe('Custom Title');
    });
  });

  describe('cleaningServicesTitle branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.cleaningServicesTitle).toBe('Cleaning Services');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, cleaningServicesTitle: 'Our Services' });
      expect(portfolio.cleaningServicesTitle).toBe('Our Services');
    });
  });

  describe('aboutUs branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.aboutUs).toBe('We provide top-notch cleaning services for residential and commercial properties. Our experienced team ensures every corner shines.');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({ ...validPortfolioData, aboutUs: 'Custom about us' });
      expect(portfolio.aboutUs).toBe('Custom about us');
    });
  });

  describe('contactInfo.phone branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.contactInfo.phone).toBe('');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        contactInfo: { phone: '555-1234' }
      });
      expect(portfolio.contactInfo.phone).toBe('555-1234');
    });
  });

  describe('contactInfo.email branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.contactInfo.email).toBe('');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        contactInfo: { email: 'test@test.com' }
      });
      expect(portfolio.contactInfo.email).toBe('test@test.com');
    });
  });

  describe('contactInfo.address branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.contactInfo.address).toBe('');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        contactInfo: { address: '123 Main St' }
      });
      expect(portfolio.contactInfo.address).toBe('123 Main St');
    });
  });

  describe('contactInfo.workingHours branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.contactInfo.workingHours).toBe('Mon-Fri: 8AM-6PM');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        contactInfo: { workingHours: '24/7' }
      });
      expect(portfolio.contactInfo.workingHours).toBe('24/7');
    });
  });

  describe('theme.primaryColor branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.theme.primaryColor).toBe('#3B82F6');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        theme: { primaryColor: '#FF0000' }
      });
      expect(portfolio.theme.primaryColor).toBe('#FF0000');
    });
  });

  describe('theme.secondaryColor branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.theme.secondaryColor).toBe('#10B981');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        theme: { secondaryColor: '#00FF00' }
      });
      expect(portfolio.theme.secondaryColor).toBe('#00FF00');
    });
  });

  describe('theme.fontFamily branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.theme.fontFamily).toBe('Inter');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        theme: { fontFamily: 'Roboto' }
      });
      expect(portfolio.theme.fontFamily).toBe('Roboto');
    });
  });

  describe('roomLabels.bedroom branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.roomLabels.bedroom).toBe('Bedroom');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        roomLabels: { bedroom: 'Master Bedroom' }
      });
      expect(portfolio.roomLabels.bedroom).toBe('Master Bedroom');
    });
  });

  describe('roomLabels.kitchen branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.roomLabels.kitchen).toBe('Kitchen');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        roomLabels: { kitchen: 'Gourmet Kitchen' }
      });
      expect(portfolio.roomLabels.kitchen).toBe('Gourmet Kitchen');
    });
  });

  describe('roomLabels.bathroom branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.roomLabels.bathroom).toBe('Bathroom');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        roomLabels: { bathroom: 'Restroom' }
      });
      expect(portfolio.roomLabels.bathroom).toBe('Restroom');
    });
  });

  describe('roomLabels.livingRoom branches', () => {
    it('should use default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.roomLabels.livingRoom).toBe('Living Room');
    });

    it('should use provided value', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        roomLabels: { livingRoom: 'Family Room' }
      });
      expect(portfolio.roomLabels.livingRoom).toBe('Family Room');
    });
  });

  describe('services array branches', () => {
    it('should default to empty array', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.services).toEqual([]);
      expect(portfolio.services).toHaveLength(0);
    });

    it('should accept provided services', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        services: [
          { title: 'Service 1', description: 'Desc 1', price: '100' },
          { title: 'Service 2', description: 'Desc 2', price: '200' }
        ]
      });
      expect(portfolio.services).toHaveLength(2);
      expect(portfolio.services[0].title).toBe('Service 1');
    });
  });

  describe('roomPricing array branches', () => {
    it('should default to empty array', () => {
      const portfolio = new Portfolio(validPortfolioData);
      expect(portfolio.roomPricing).toEqual([]);
      expect(portfolio.roomPricing).toHaveLength(0);
    });

    it('should accept provided roomPricing', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        roomPricing: [
          { roomType: 'bedroom', price: 50 },
          { roomType: 'kitchen', price: 75 }
        ]
      });
      expect(portfolio.roomPricing).toHaveLength(2);
      expect(portfolio.roomPricing[0].roomType).toBe('bedroom');
    });
  });

  describe('Edge cases and combinations', () => {
    it('should handle all custom values together', () => {
      const customData = {
        userId: new mongoose.Types.ObjectId(),
        slug: 'custom-slug',
        templateType: 'premium',
        isPublished: true,
        businessName: 'Premium Cleaners',
        tagline: 'Custom tagline',
        tagline1: 'Custom 1',
        tagline2: 'Custom 2',
        tagline3: 'Custom 3',
        buildRoomsTitle: 'Custom Rooms',
        cleaningServicesTitle: 'Custom Services',
        aboutUs: 'Custom about',
        services: [{ title: 'Service' }],
        roomPricing: [{ roomType: 'bedroom', price: 50 }],
        contactInfo: {
          phone: '555-1234',
          email: 'test@test.com',
          address: '123 Main',
          workingHours: '24/7'
        },
        theme: {
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          fontFamily: 'Arial'
        },
        roomLabels: {
          bedroom: 'Bed',
          kitchen: 'Cook',
          bathroom: 'Bath',
          livingRoom: 'Live'
        }
      };

      const portfolio = new Portfolio(customData);
      const error = portfolio.validateSync();

      expect(error).toBeUndefined();
      expect(portfolio.templateType).toBe('premium');
      expect(portfolio.isPublished).toBe(true);
      expect(portfolio.businessName).toBe('Premium Cleaners');
      expect(portfolio.contactInfo.phone).toBe('555-1234');
      expect(portfolio.theme.primaryColor).toBe('#FF0000');
      expect(portfolio.roomLabels.bedroom).toBe('Bed');
      expect(portfolio.services).toHaveLength(1);
      expect(portfolio.roomPricing).toHaveLength(1);
    });

    it('should handle empty strings', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        businessName: '',
        tagline: '',
        aboutUs: ''
      });

      expect(portfolio.businessName).toBe('');
      expect(portfolio.tagline).toBe('');
      expect(portfolio.aboutUs).toBe('');
    });

    it('should handle null values', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        businessName: null,
        tagline: null
      });

      expect(portfolio.businessName).toBeNull();
      expect(portfolio.tagline).toBeNull();
    });

    it('should handle partial nested objects', () => {
      const portfolio = new Portfolio({
        ...validPortfolioData,
        contactInfo: { phone: '555-1234' },
        theme: { primaryColor: '#FF0000' },
        roomLabels: { bedroom: 'Suite' }
      });

      expect(portfolio.contactInfo.phone).toBe('555-1234');
      expect(portfolio.contactInfo.email).toBe(''); // default
      expect(portfolio.theme.primaryColor).toBe('#FF0000');
      expect(portfolio.theme.secondaryColor).toBe('#10B981'); // default
      expect(portfolio.roomLabels.bedroom).toBe('Suite');
      expect(portfolio.roomLabels.kitchen).toBe('Kitchen'); // default
    });

    it('should allow array modifications', () => {
      const portfolio = new Portfolio(validPortfolioData);

      portfolio.services.push({ title: 'New Service', price: '150' });
      portfolio.roomPricing.push({ roomType: 'office', price: 100 });

      expect(portfolio.services).toHaveLength(1);
      expect(portfolio.roomPricing).toHaveLength(1);
    });

    it('should allow updating boolean field', () => {
      const portfolio = new Portfolio(validPortfolioData);

      expect(portfolio.isPublished).toBe(false);
      portfolio.isPublished = true;
      expect(portfolio.isPublished).toBe(true);
    });
  });
});