const mongoose = require('mongoose');
const SoftwareEng = require('../models/softwareeng');

describe('SoftwareEng Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test-portfolio');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SoftwareEng.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid software engineer portfolio', async () => {
      const validPortfolio = {
        ownerId: 'test@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Test User',
          email: 'test@example.com',
          location: 'Test City, TX',
          github: 'https://github.com/testuser',
          linkedin: 'https://linkedin.com/in/testuser',
          bio: 'Test bio',
          avatarUrl: ''
        },
        skills: [
          { name: 'JavaScript', level: 'Advanced', rating: 5 }
        ],
        projects: [
          {
            title: 'Test Project',
            description: 'Test description',
            repoUrl: 'https://github.com/testuser/project',
            demoUrl: 'https://demo.test.com',
            techStack: ['React', 'Node.js'],
            imageUrl: null
          }
        ],
        experience: [
          {
            company: 'Test Company',
            role: 'Software Engineer',
            duration: '2022-2023',
            details: 'Test job description'
          }
        ],
        education: [
          {
            degree: 'Bachelor of Science in Computer Science',
            institution: 'Test University',
            year: '2022'
          }
        ],
        certifications: [
          {
            title: 'AWS Certified Developer',
            year: '2023',
            imageUrl: '/uploads/test-cert.pdf'
          }
        ],
        resumePdfUrl: '',
        uiSettings: {
          baseRem: 1,
          sectionRem: {
            about: 1,
            skills: 1,
            projects: 1,
            experience: 1,
            education: 1,
            certifications: 1
          }
        }
      };

      const portfolio = new SoftwareEng(validPortfolio);
      const savedPortfolio = await portfolio.save();

      expect(savedPortfolio.ownerId).toBe(validPortfolio.ownerId);
      expect(savedPortfolio.type).toBe(validPortfolio.type);
      expect(savedPortfolio.profile.name).toBe(validPortfolio.profile.name);
      expect(savedPortfolio.skills).toHaveLength(1);
      expect(savedPortfolio.projects).toHaveLength(1);
      expect(savedPortfolio.experience).toHaveLength(1);
      expect(savedPortfolio.education).toHaveLength(1);
      expect(savedPortfolio.certifications).toHaveLength(1);
    });

    it('should handle missing optional fields', async () => {
      const minimalPortfolio = {
        ownerId: 'minimal@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Minimal User',
          email: 'minimal@example.com'
        }
      };

      const portfolio = new SoftwareEng(minimalPortfolio);
      const savedPortfolio = await portfolio.save();

      expect(savedPortfolio.ownerId).toBe(minimalPortfolio.ownerId);
      expect(savedPortfolio.profile.name).toBe(minimalPortfolio.profile.name);
      expect(savedPortfolio.skills).toEqual([]);
      expect(savedPortfolio.projects).toEqual([]);
      expect(savedPortfolio.experience).toEqual([]);
      expect(savedPortfolio.education).toEqual([]);
      expect(savedPortfolio.certifications).toEqual([]);
    });

    it('should handle empty arrays for collections', async () => {
      const portfolioWithEmptyArrays = {
        ownerId: 'empty@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Empty User',
          email: 'empty@example.com'
        },
        skills: [],
        projects: [],
        experience: [],
        education: [],
        certifications: []
      };

      const portfolio = new SoftwareEng(portfolioWithEmptyArrays);
      const savedPortfolio = await portfolio.save();

      expect(savedPortfolio.skills).toEqual([]);
      expect(savedPortfolio.projects).toEqual([]);
      expect(savedPortfolio.experience).toEqual([]);
      expect(savedPortfolio.education).toEqual([]);
      expect(savedPortfolio.certifications).toEqual([]);
    });
  });

  describe('Model Methods', () => {
    it('should find portfolio by ownerId', async () => {
      const portfolioData = {
        ownerId: 'find@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Find User',
          email: 'find@example.com'
        }
      };

      await SoftwareEng.create(portfolioData);

      const foundPortfolio = await SoftwareEng.findOne({ ownerId: 'find@example.com' });
      expect(foundPortfolio).toBeTruthy();
      expect(foundPortfolio.ownerId).toBe('find@example.com');
    });

    it('should update portfolio by ownerId', async () => {
      const portfolioData = {
        ownerId: 'update@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Update User',
          email: 'update@example.com'
        }
      };

      await SoftwareEng.create(portfolioData);

      const updatedPortfolio = await SoftwareEng.findOneAndUpdate(
        { ownerId: 'update@example.com' },
        { 'profile.name': 'Updated Name' },
        { new: true }
      );

      expect(updatedPortfolio.profile.name).toBe('Updated Name');
    });

    it('should delete portfolio by ownerId', async () => {
      const portfolioData = {
        ownerId: 'delete@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Delete User',
          email: 'delete@example.com'
        }
      };

      await SoftwareEng.create(portfolioData);

      const deletedPortfolio = await SoftwareEng.findOneAndDelete({ ownerId: 'delete@example.com' });
      expect(deletedPortfolio).toBeTruthy();
      expect(deletedPortfolio.ownerId).toBe('delete@example.com');

      const foundPortfolio = await SoftwareEng.findOne({ ownerId: 'delete@example.com' });
      expect(foundPortfolio).toBeNull();
    });
  });

  describe('Data Types', () => {
    it('should handle string fields correctly', async () => {
      const portfolio = new SoftwareEng({
        ownerId: 'string@example.com',
        type: 'software_engineer',
        profile: {
          name: 'String User',
          email: 'string@example.com'
        }
      });

      const savedPortfolio = await portfolio.save();
      expect(typeof savedPortfolio.ownerId).toBe('string');
      expect(typeof savedPortfolio.type).toBe('string');
      expect(typeof savedPortfolio.profile.name).toBe('string');
    });

    it('should handle number fields in skills rating', async () => {
      const portfolio = new SoftwareEng({
        ownerId: 'number@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Number User',
          email: 'number@example.com'
        },
        skills: [
          { name: 'JavaScript', level: 'Advanced', rating: 5 }
        ]
      });

      const savedPortfolio = await portfolio.save();
      expect(typeof savedPortfolio.skills[0].rating).toBe('number');
      expect(savedPortfolio.skills[0].rating).toBe(5);
    });

    it('should handle array fields correctly', async () => {
      const portfolio = new SoftwareEng({
        ownerId: 'array@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Array User',
          email: 'array@example.com'
        },
        skills: [
          { name: 'JavaScript', level: 'Advanced' },
          { name: 'React', level: 'Intermediate' }
        ]
      });

      const savedPortfolio = await portfolio.save();
      expect(Array.isArray(savedPortfolio.skills)).toBe(true);
      expect(savedPortfolio.skills).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text fields', async () => {
      const longBio = 'A'.repeat(1000);
      const portfolio = new SoftwareEng({
        ownerId: 'long@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Long User',
          email: 'long@example.com',
          bio: longBio
        }
      });

      const savedPortfolio = await portfolio.save();
      expect(savedPortfolio.profile.bio).toBe(longBio);
    });

    it('should handle special characters in text fields', async () => {
      const specialText = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const portfolio = new SoftwareEng({
        ownerId: 'special@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Special User',
          email: 'special@example.com',
          bio: specialText
        }
      });

      const savedPortfolio = await portfolio.save();
      expect(savedPortfolio.profile.bio).toBe(specialText);
    });

    it('should handle unicode characters', async () => {
      const unicodeText = 'Unicode: 你好世界 🌍 émojis 🚀';
      const portfolio = new SoftwareEng({
        ownerId: 'unicode@example.com',
        type: 'software_engineer',
        profile: {
          name: 'Unicode User',
          email: 'unicode@example.com',
          bio: unicodeText
        }
      });

      const savedPortfolio = await portfolio.save();
      expect(savedPortfolio.profile.bio).toBe(unicodeText);
    });
  });
});

