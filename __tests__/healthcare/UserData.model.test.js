/**
 * UserData Model Tests - BE-HC-1
 * Tests for the UserData model (models/healthcare/userData.js)
 * 
 * Covers: Required fields, nested objects, arrays, validation, indexes
 */

const mongoose = require('mongoose');
const UserData = require('../../models/healthcare/userData');

// Helper functions
const uniquePracticeId = () => `practice_${Date.now()}_${Math.random()}`;
const uniqueUserId = () => `user_${Date.now()}_${Math.random()}`;
const uniqueSubdomain = () => `subdomain${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

describe('UserData Model Validation Tests', () => {

  describe('Required Fields Validation', () => {
    
    test('should require practiceId field', async () => {
      const userDataWithoutPracticeId = new UserData({
        userId: uniqueUserId(),
        practice: { name: 'Test Practice' }
      });

      let error;
      try {
        await userDataWithoutPracticeId.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.practiceId).toBeDefined();
    });

    test('should require userId field', async () => {
      const userDataWithoutUserId = new UserData({
        practiceId: uniquePracticeId(),
        practice: { name: 'Test Practice' }
      });

      let error;
      try {
        await userDataWithoutUserId.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.userId).toBeDefined();
    });

    test('should require practice.name field', async () => {
      const userDataWithoutName = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: {}
      });

      let error;
      try {
        await userDataWithoutName.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors['practice.name']).toBeDefined();
    });

    test('should create userData with all required fields', async () => {
      const validUserData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: {
          name: 'Test Medical Center'
        }
      });

      const saved = await validUserData.save();
      expect(saved._id).toBeDefined();
      expect(saved.practiceId).toBeDefined();
      expect(saved.userId).toBeDefined();
      expect(saved.practice.name).toBe('Test Medical Center');
    });
  });

  describe('Subdomain Validation', () => {
    
    test('should accept valid subdomain', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        subdomain: uniqueSubdomain(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.subdomain).toBeDefined();
    });

    test('should convert subdomain to lowercase', async () => {
      const mixedCase = `TestSubDomain${Date.now()}`;
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        subdomain: mixedCase,
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.subdomain).toBe(mixedCase.toLowerCase());
    });

    test('should trim whitespace from subdomain', async () => {
      const withSpaces = `  testsubdomain${Date.now()}  `;
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        subdomain: withSpaces,
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.subdomain).toBe(withSpaces.trim().toLowerCase());
    });

    test('should enforce unique subdomain', async () => {
      const subdomain = uniqueSubdomain();

      await UserData.create({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        subdomain,
        practice: { name: 'First Practice' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      let error;
      try {
        await UserData.create({
          practiceId: uniquePracticeId(),
          userId: uniqueUserId(),
          subdomain, // Same subdomain
          practice: { name: 'Second Practice' }
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // Duplicate key error
    });

    test('should allow null subdomain (sparse index)', async () => {
      const userData1 = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Practice 1' }
        // No subdomain
      });

      const userData2 = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Practice 2' }
        // No subdomain
      });

      expect(userData1.subdomain).toBeUndefined();
      expect(userData2.subdomain).toBeUndefined();
    });
  });

  describe('Practice Section Fields', () => {
    
    test('should handle all practice fields', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: {
          name: 'Elite Medical Center',
          tagline: 'Your Health, Our Priority',
          description: 'Comprehensive healthcare services'
        }
      });

      const saved = await userData.save();
      expect(saved.practice.name).toBe('Elite Medical Center');
      expect(saved.practice.tagline).toBe('Your Health, Our Priority');
      expect(saved.practice.description).toBe('Comprehensive healthcare services');
    });

    test('should use default empty strings for optional practice fields', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: {
          name: 'Test Practice'
        }
      });

      const saved = await userData.save();
      expect(saved.practice.tagline).toBe('');
      expect(saved.practice.description).toBe('');
    });
  });

  describe('Contact Section Fields', () => {
    
    test('should handle complete contact information', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        contact: {
          phone: '+1234567890',
          whatsapp: '+1234567890',
          email: 'contact@example.com',
          address: {
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701'
          }
        }
      });

      const saved = await userData.save();
      expect(saved.contact.phone).toBe('+1234567890');
      expect(saved.contact.email).toBe('contact@example.com');
      expect(saved.contact.address.city).toBe('Austin');
    });

    test('should use defaults for empty contact fields', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.contact.phone).toBe('');
      expect(saved.contact.email).toBe('');
      expect(saved.contact.address.street).toBe('');
    });
  });

  describe('Hours Section Fields', () => {
    
    test('should use default hours', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.hours.weekdays).toBe('Mon-Fri: 9:00 AM - 5:00 PM');
      expect(saved.hours.saturday).toBe('Sat: Closed');
      expect(saved.hours.sunday).toBe('Sun: Closed');
    });

    test('should allow custom hours', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        hours: {
          weekdays: 'Mon-Fri: 8:00 AM - 6:00 PM',
          saturday: 'Sat: 9:00 AM - 2:00 PM',
          sunday: 'Sun: Closed'
        }
      });

      const saved = await userData.save();
      expect(saved.hours.weekdays).toBe('Mon-Fri: 8:00 AM - 6:00 PM');
      expect(saved.hours.saturday).toBe('Sat: 9:00 AM - 2:00 PM');
    });
  });

  describe('Stats Section Fields', () => {
    
    test('should use default stats values', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.stats.yearsExperience).toBe('0');
      expect(saved.stats.patientsServed).toBe('0');
      expect(saved.stats.successRate).toBe('0');
      expect(saved.stats.doctorsCount).toBe('0');
    });

    test('should store stats as strings', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        stats: {
          yearsExperience: '15',
          patientsServed: '5,000',
          successRate: '98',
          doctorsCount: '8'
        }
      });

      const saved = await userData.save();
      expect(typeof saved.stats.yearsExperience).toBe('string');
      expect(saved.stats.yearsExperience).toBe('15');
      expect(saved.stats.patientsServed).toBe('5,000');
    });
  });

  describe('Services Array', () => {
    
    test('should handle empty services array', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(Array.isArray(saved.services)).toBe(true);
      expect(saved.services).toHaveLength(0);
    });

    test('should handle multiple services', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        services: [
          {
            id: 'service1',
            title: 'Primary Care',
            description: 'General healthcare',
            icon: 'medical',
            price: '$150',
            duration: '45 min',
            features: ['Checkup', 'Consultation']
          },
          {
            id: 'service2',
            title: 'Dental Care',
            description: 'Dental services',
            price: '$200',
            features: ['Cleaning', 'Examination']
          }
        ]
      });

      const saved = await userData.save();
      expect(saved.services).toHaveLength(2);
      expect(saved.services[0].title).toBe('Primary Care');
      expect(saved.services[1].title).toBe('Dental Care');
    });

    test('should handle nested features array', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        services: [{
          id: 'service1',
          title: 'Service',
          features: ['Feature 1', 'Feature 2', 'Feature 3']
        }]
      });

      const saved = await userData.save();
      expect(saved.services[0].features).toHaveLength(3);
      expect(saved.services[0].features).toContain('Feature 1');
    });
  });

  describe('Blog Posts Array', () => {
    
    test('should handle empty blog posts array', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(Array.isArray(saved.blogPosts)).toBe(true);
      expect(saved.blogPosts).toHaveLength(0);
    });

    test('should handle complete blog post structure', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        blogPosts: [{
          id: 1,
          title: 'Health Tips 2024',
          slug: 'health-tips-2024',
          excerpt: 'Latest health strategies',
          content: '<p>Content here</p>',
          publishDate: '2024-01-01',
          author: { name: 'Dr. Smith', id: 'dr1' },
          category: 'Health',
          tags: ['health', 'tips'],
          readTime: '5 min',
          featured: true
        }]
      });

      const saved = await userData.save();
      expect(saved.blogPosts).toHaveLength(1);
      expect(saved.blogPosts[0].title).toBe('Health Tips 2024');
      expect(saved.blogPosts[0].author.name).toBe('Dr. Smith');
      expect(saved.blogPosts[0].tags).toContain('health');
      expect(saved.blogPosts[0].featured).toBe(true);
    });
  });

  describe('Gallery Section', () => {
    
    test('should handle facility images array', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        gallery: {
          facilityImages: [
            {
              url: 'https://example.com/image1.jpg',
              caption: 'Reception Area',
              description: 'Our welcoming reception'
            },
            {
              url: 'https://example.com/image2.jpg',
              caption: 'Treatment Room'
            }
          ]
        }
      });

      const saved = await userData.save();
      expect(saved.gallery.facilityImages).toHaveLength(2);
      expect(saved.gallery.facilityImages[0].caption).toBe('Reception Area');
    });

    test('should handle before/after cases', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        gallery: {
          beforeAfterCases: [{
            title: 'Smile Transformation',
            treatment: 'Orthodontics',
            duration: '12 months',
            description: 'Patient testimonial',
            beforeImage: 'before.jpg',
            afterImage: 'after.jpg'
          }]
        }
      });

      const saved = await userData.save();
      expect(saved.gallery.beforeAfterCases).toHaveLength(1);
      expect(saved.gallery.beforeAfterCases[0].title).toBe('Smile Transformation');
    });
  });

  describe('SEO Section', () => {
    
    test('should use default empty strings for SEO', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.seo.siteTitle).toBe('');
      expect(saved.seo.metaDescription).toBe('');
      expect(saved.seo.keywords).toBe('');
    });

    test('should store custom SEO data', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        seo: {
          siteTitle: 'Best Medical Center',
          metaDescription: 'Top healthcare services',
          keywords: 'medical, healthcare, clinic'
        }
      });

      const saved = await userData.save();
      expect(saved.seo.siteTitle).toBe('Best Medical Center');
      expect(saved.seo.keywords).toBe('medical, healthcare, clinic');
    });
  });

  describe('UI Section', () => {
    
    test('should handle UI customization fields', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        ui: {
          hero: {
            primaryButtonText: 'Book Now',
            secondaryButtonText: 'Learn More'
          },
          services: {
            viewAllText: 'See All Services',
            bookButtonText: 'Schedule'
          }
        }
      });

      const saved = await userData.save();
      expect(saved.ui.hero.primaryButtonText).toBe('Book Now');
      expect(saved.ui.services.viewAllText).toBe('See All Services');
    });

    test('should use default UI text', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.ui.hero.primaryButtonText).toBe('Get Started');
      expect(saved.ui.contact.buttonText).toBe('Contact Us');
    });

    test('should handle social media links', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        ui: {
          social: {
            facebook: 'https://facebook.com/practice',
            instagram: 'https://instagram.com/practice',
            twitter: 'https://twitter.com/practice'
          }
        }
      });

      const saved = await userData.save();
      expect(saved.ui.social.facebook).toContain('facebook.com');
    });
  });

  describe('Timestamp and Status Fields', () => {
    
    test('should automatically set createdAt', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.createdAt).toBeDefined();
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    test('should automatically set lastModified', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.lastModified).toBeDefined();
      expect(saved.lastModified).toBeInstanceOf(Date);
    });

    test('should update lastModified on save', async () => {
      const userData = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const originalModified = userData.lastModified;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      userData.practice.name = 'Updated';
      await userData.save();
      
      expect(userData.lastModified.getTime()).toBeGreaterThan(originalModified.getTime());
    });

    test('should default isActive to true', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const saved = await userData.save();
      expect(saved.isActive).toBe(true);
    });

    test('should allow setting isActive to false', async () => {
      const userData = new UserData({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' },
        isActive: false
      });

      const saved = await userData.save();
      expect(saved.isActive).toBe(false);
    });
  });

  describe('Model Indexes', () => {
    
    test('should have index on practiceId', () => {
      const indexes = UserData.schema.indexes();
      const practiceIdIndex = indexes.find(index => index[0].practiceId);
      expect(practiceIdIndex).toBeDefined();
    });

    test('should have index on userId', () => {
      const indexes = UserData.schema.indexes();
      const userIdIndex = indexes.find(index => index[0].userId);
      expect(userIdIndex).toBeDefined();
    });

    test('should enforce unique practiceId', async () => {
      const practiceId = uniquePracticeId();

      await UserData.create({
        practiceId,
        userId: uniqueUserId(),
        practice: { name: 'First' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      let error;
      try {
        await UserData.create({
          practiceId, // Same practiceId
          userId: uniqueUserId(),
          practice: { name: 'Second' }
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000);
    });
  });

  describe('Pre-save Middleware', () => {
    
    test('should update lastModified on each save', async () => {
      const userData = await UserData.create({
        practiceId: uniquePracticeId(),
        userId: uniqueUserId(),
        practice: { name: 'Test' }
      });

      const firstModified = userData.lastModified;

      await new Promise(resolve => setTimeout(resolve, 100));

      userData.practice.name = 'Updated';
      await userData.save();

      expect(userData.lastModified.getTime()).toBeGreaterThan(firstModified.getTime());
    });
  });
});