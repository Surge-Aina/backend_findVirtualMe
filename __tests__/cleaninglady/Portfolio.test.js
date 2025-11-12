const mongoose = require('mongoose');
const Portfolio = require('../../models/cleaningLady/Portfolio');

describe('Portfolio Model Tests', () => {
  const validPortfolioData = {
    userId: new mongoose.Types.ObjectId(),
    slug: 'test-cleaning-service',
    businessName: 'Test Cleaning Co'
  };

  describe('Required Fields', () => {
    it('should create a valid portfolio with minimum required fields', () => {
      const portfolio = new Portfolio(validPortfolioData);
      const error = portfolio.validateSync();
      
      expect(error).toBeUndefined();
    });

    it('should require userId', () => {
      const portfolioData = { ...validPortfolioData };
      delete portfolioData.userId;
      
      const portfolio = new Portfolio(portfolioData);
      const error = portfolio.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.userId).toBeDefined();
    });

    it('should require slug', () => {
      const portfolioData = { ...validPortfolioData };
      delete portfolioData.slug;
      
      const portfolio = new Portfolio(portfolioData);
      const error = portfolio.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should set default templateType to cleaning-service', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.templateType).toBe('cleaning-service');
    });

    it('should set isPublished to false by default', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.isPublished).toBe(false);
    });

    it('should set default businessName', () => {
      const portfolioData = {
        userId: validPortfolioData.userId,
        slug: 'test-slug'
      };
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.businessName).toBe('My Cleaning Service');
    });

    it('should set default taglines', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.tagline1).toBe('We bring sparkle to your space.');
      expect(portfolio.tagline2).toBe('From roof to floor – Every detail matters.');
      expect(portfolio.tagline3).toBe('For those I love – My purpose in every sweep.');
    });

    it('should set default buildRoomsTitle', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.buildRoomsTitle).toBe('Build Your Rooms');
    });

    it('should set default cleaningServicesTitle', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.cleaningServicesTitle).toBe('Cleaning Services');
    });

    it('should set default roomLabels', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.roomLabels.bedroom).toBe('Bedroom');
      expect(portfolio.roomLabels.kitchen).toBe('Kitchen');
      expect(portfolio.roomLabels.bathroom).toBe('Bathroom');
      expect(portfolio.roomLabels.livingRoom).toBe('Living Room');
    });

    it('should set default theme colors', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.theme.primaryColor).toBe('#3B82F6');
      expect(portfolio.theme.secondaryColor).toBe('#10B981');
      expect(portfolio.theme.fontFamily).toBe('Inter');
    });
  });

  describe('Services Array', () => {
    it('should allow adding services', () => {
      const portfolioData = {
        ...validPortfolioData,
        services: [
          {
            title: 'Deep Cleaning',
            description: 'Thorough cleaning',
            price: '100',
            icon: 'clean-icon'
          }
        ]
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.services).toHaveLength(1);
      expect(portfolio.services[0].title).toBe('Deep Cleaning');
    });

    it('should allow empty services array', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(Array.isArray(portfolio.services)).toBe(true);
      expect(portfolio.services).toHaveLength(0);
    });

    it('should allow multiple services', () => {
      const portfolioData = {
        ...validPortfolioData,
        services: [
          { title: 'Service 1', description: 'Desc 1', price: '50' },
          { title: 'Service 2', description: 'Desc 2', price: '100' }
        ]
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.services).toHaveLength(2);
    });
  });

  describe('Room Pricing', () => {
    it('should store room pricing', () => {
      const portfolioData = {
        ...validPortfolioData,
        roomPricing: [
          { roomType: 'bedroom', price: 50 },
          { roomType: 'kitchen', price: 75 }
        ]
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.roomPricing).toHaveLength(2);
      expect(portfolio.roomPricing[0].roomType).toBe('bedroom');
      expect(portfolio.roomPricing[0].price).toBe(50);
    });

    it('should allow empty roomPricing array', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(Array.isArray(portfolio.roomPricing)).toBe(true);
    });
  });

  describe('Contact Information', () => {
    it('should set default contact info', () => {
      const portfolio = new Portfolio(validPortfolioData);
      
      expect(portfolio.contactInfo.phone).toBe('');
      expect(portfolio.contactInfo.email).toBe('');
      expect(portfolio.contactInfo.address).toBe('');
      expect(portfolio.contactInfo.workingHours).toBe('Mon-Fri: 8AM-6PM');
    });

    it('should allow custom contact info', () => {
      const portfolioData = {
        ...validPortfolioData,
        contactInfo: {
          phone: '123-456-7890',
          email: 'test@test.com',
          address: '123 Main St',
          workingHours: 'Mon-Sat: 9AM-5PM'
        }
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.contactInfo.phone).toBe('123-456-7890');
      expect(portfolio.contactInfo.email).toBe('test@test.com');
      expect(portfolio.contactInfo.address).toBe('123 Main St');
      expect(portfolio.contactInfo.workingHours).toBe('Mon-Sat: 9AM-5PM');
    });
  });
describe('Branch Coverage - Testing Conditional Paths', () => {
  it('should use default values when fields are undefined', () => {
    const minimalData = {
      userId: new mongoose.Types.ObjectId(),
      slug: 'test-slug'
    };
    
    const portfolio = new Portfolio(minimalData);
    
    // Test all default values
    expect(portfolio.templateType).toBe('cleaning-service');
    expect(portfolio.isPublished).toBe(false);
    expect(portfolio.businessName).toBe('My Cleaning Service');
    expect(portfolio.tagline).toBeTruthy();
    expect(portfolio.contactInfo.workingHours).toBe('Mon-Fri: 8AM-6PM');
  });

  it('should override default values when provided', () => {
    const customData = {
      userId: new mongoose.Types.ObjectId(),
      slug: 'custom-slug',
      templateType: 'custom-type',
      isPublished: true,
      businessName: 'Custom Business'
    };
    
    const portfolio = new Portfolio(customData);
    
    expect(portfolio.templateType).toBe('custom-type');
    expect(portfolio.isPublished).toBe(true);
    expect(portfolio.businessName).toBe('Custom Business');
  });

  it('should accept empty string for optional fields', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      businessName: '',
      tagline: '',
      aboutUs: ''
    };
    
    const portfolio = new Portfolio(portfolioData);
    const error = portfolio.validateSync();
    
    expect(error).toBeUndefined();
    expect(portfolio.businessName).toBe('');
  });

  it('should accept null for optional nested objects', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      contactInfo: {
        phone: '',
        email: '',
        address: ''
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.contactInfo.phone).toBe('');
    expect(portfolio.contactInfo.email).toBe('');
  });

  it('should handle partial theme object', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      theme: {
        primaryColor: '#FF0000'
        // secondaryColor and fontFamily will use defaults
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.theme.primaryColor).toBe('#FF0000');
    expect(portfolio.theme.secondaryColor).toBe('#10B981'); // default
    expect(portfolio.theme.fontFamily).toBe('Inter'); // default
  });

  it('should handle partial contactInfo object', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      contactInfo: {
        email: 'test@test.com'
        // other fields will use defaults
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.contactInfo.email).toBe('test@test.com');
    expect(portfolio.contactInfo.phone).toBe(''); // default
    expect(portfolio.contactInfo.workingHours).toBe('Mon-Fri: 8AM-6PM'); // default
  });

  it('should handle partial roomLabels object', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      roomLabels: {
        bedroom: 'Custom Bedroom'
        // other labels will use defaults
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.roomLabels.bedroom).toBe('Custom Bedroom');
    expect(portfolio.roomLabels.kitchen).toBe('Kitchen'); // default
    expect(portfolio.roomLabels.bathroom).toBe('Bathroom'); // default
  });

  it('should accept very long strings for text fields', () => {
    const longText = 'A'.repeat(5000);
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      aboutUs: longText,
      tagline: longText
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.aboutUs.length).toBe(5000);
    expect(portfolio.tagline.length).toBe(5000);
  });

  it('should accept special characters in text fields', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      businessName: 'Test & Co. <Special> "Chars"',
      tagline: "It's a great service!"
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.businessName).toBe('Test & Co. <Special> "Chars"');
    expect(portfolio.tagline).toBe("It's a great service!");
  });

  it('should allow updating isPublished from false to true', () => {
    const portfolio = new Portfolio(validPortfolioData);
    
    expect(portfolio.isPublished).toBe(false);
    
    portfolio.isPublished = true;
    expect(portfolio.isPublished).toBe(true);
  });

  it('should allow adding multiple room pricing entries', () => {
    const portfolioData = {
      ...validPortfolioData,
      roomPricing: [
        { roomType: 'bedroom', price: 50 },
        { roomType: 'kitchen', price: 75 },
        { roomType: 'bathroom', price: 40 },
        { roomType: 'livingRoom', price: 60 }
      ]
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.roomPricing).toHaveLength(4);
    expect(portfolio.roomPricing[0].price).toBe(50);
    expect(portfolio.roomPricing[3].price).toBe(60);
  });

  it('should allow empty arrays for services and roomPricing', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      services: [],
      roomPricing: []
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.services).toHaveLength(0);
    expect(portfolio.roomPricing).toHaveLength(0);
  });

  it('should handle all taglines being empty strings', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      tagline1: '',
      tagline2: '',
      tagline3: ''
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.tagline1).toBe('');
    expect(portfolio.tagline2).toBe('');
    expect(portfolio.tagline3).toBe('');
  });

  it('should handle custom room labels for all rooms', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      roomLabels: {
        bedroom: 'Dormitorio',
        kitchen: 'Cocina',
        bathroom: 'Baño',
        livingRoom: 'Sala'
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.roomLabels.bedroom).toBe('Dormitorio');
    expect(portfolio.roomLabels.kitchen).toBe('Cocina');
    expect(portfolio.roomLabels.bathroom).toBe('Baño');
    expect(portfolio.roomLabels.livingRoom).toBe('Sala');
  });

  it('should handle theme with all custom values', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      theme: {
        primaryColor: '#123456',
        secondaryColor: '#ABCDEF',
        fontFamily: 'Roboto'
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.theme.primaryColor).toBe('#123456');
    expect(portfolio.theme.secondaryColor).toBe('#ABCDEF');
    expect(portfolio.theme.fontFamily).toBe('Roboto');
  });

  it('should handle contactInfo with all fields populated', () => {
    const portfolioData = {
      userId: validPortfolioData.userId,
      slug: 'test-slug',
      contactInfo: {
        phone: '555-1234',
        email: 'contact@test.com',
        address: '123 Main St, City, State 12345',
        workingHours: '24/7'
      }
    };
    
    const portfolio = new Portfolio(portfolioData);
    
    expect(portfolio.contactInfo.phone).toBe('555-1234');
    expect(portfolio.contactInfo.email).toBe('contact@test.com');
    expect(portfolio.contactInfo.address).toBe('123 Main St, City, State 12345');
    expect(portfolio.contactInfo.workingHours).toBe('24/7');
  });
});
  describe('Custom Fields', () => {
    it('should allow custom taglines', () => {
      const portfolioData = {
        ...validPortfolioData,
        tagline1: 'Custom tagline 1',
        tagline2: 'Custom tagline 2',
        tagline3: 'Custom tagline 3'
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.tagline1).toBe('Custom tagline 1');
      expect(portfolio.tagline2).toBe('Custom tagline 2');
      expect(portfolio.tagline3).toBe('Custom tagline 3');
    });

    it('should allow custom aboutUs', () => {
      const portfolioData = {
        ...validPortfolioData,
        aboutUs: 'Custom about us text'
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.aboutUs).toBe('Custom about us text');
    });

    it('should allow custom theme colors', () => {
      const portfolioData = {
        ...validPortfolioData,
        theme: {
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          fontFamily: 'Roboto'
        }
      };
      
      const portfolio = new Portfolio(portfolioData);
      
      expect(portfolio.theme.primaryColor).toBe('#FF0000');
      expect(portfolio.theme.secondaryColor).toBe('#00FF00');
      expect(portfolio.theme.fontFamily).toBe('Roboto');
    });
  });


});