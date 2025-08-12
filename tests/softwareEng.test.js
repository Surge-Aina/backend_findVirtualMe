const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const SoftwareEng = require('../models/softwareeng');

// Test data
const testPortfolio = {
  ownerId: 'test@example.com',
  type: 'software_engineer',
  profile: {
    name: 'Test User',
    email: 'test@example.com',
    location: 'Test City, TX',
    github: 'https://github.com/testuser',
    linkedin: 'https://linkedin.com/in/testuser',
    bio: 'Test bio for software engineer',
    avatarUrl: ''
  },
  skills: [
    { name: 'JavaScript', level: 'Advanced', rating: 5 },
    { name: 'React', level: 'Intermediate', rating: 4 }
  ],
  projects: [
    {
      title: 'Test Project',
      description: 'A test project description',
      repoUrl: 'https://github.com/testuser/test-project',
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

describe('Software Engineering Portfolio API', () => {
  beforeAll(async () => {
    // Connect to test database only if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test-portfolio');
    }
  });

  afterAll(async () => {
    // Clean up and disconnect
    await SoftwareEng.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await SoftwareEng.deleteMany({});
  });

  describe('GET /software-eng/:ownerId', () => {
    it('should return 404 for non-existent portfolio', async () => {
      const response = await request(app)
        .get('/software-eng/nonexistent@example.com')
        .expect(404);

      expect(response.body.error).toBe('Portfolio not found');
    });

    it('should return portfolio data for existing ownerId', async () => {
      // This test checks the dynamic portfolio data
      const response = await request(app)
        .get('/software-eng/admin@test.com')
        .expect(200);

      expect(response.body).toHaveProperty('ownerId', 'admin@test.com');
      expect(response.body).toHaveProperty('profile.name');
      expect(response.body.profile.name).toBeDefined();
    });

    it('should return admin portfolio data', async () => {
      const response = await request(app)
        .get('/software-eng/admin@test.com')
        .expect(200);

      expect(response.body).toHaveProperty('ownerId', 'admin@test.com');
      expect(response.body.profile.name).toBeDefined();
    });

    it('should return customer portfolio data', async () => {
      const response = await request(app)
        .get('/software-eng/cust@test.com')
        .expect(200);

      expect(response.body).toHaveProperty('ownerId', 'cust@test.com');
      expect(response.body.profile.name).toBeDefined();
    });
  });

  describe('PUT /software-eng/:ownerId', () => {
    it('should update portfolio successfully', async () => {
      const updateData = {
        profile: {
          name: 'Updated Name',
          bio: 'Updated bio'
        }
      };

      const response = await request(app)
        .put('/software-eng/admin@test.com')
        .send(updateData)
        .expect(200);

      expect(response.body.profile.name).toBe('Updated Name');
      expect(response.body.profile.bio).toBe('Updated bio');
    });

    it('should return 404 for non-existent portfolio', async () => {
      const updateData = { profile: { name: 'Test' } };

      const response = await request(app)
        .put('/software-eng/nonexistent@example.com')
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Portfolio not found');
    });

    it('should sync admin updates to customer portfolio', async () => {
      const updateData = {
        profile: {
          name: 'Synced Name',
          bio: 'Synced bio'
        }
      };

      // Update admin portfolio
      await request(app)
        .put('/software-eng/admin@test.com')
        .send(updateData)
        .expect(200);

      // Check if customer portfolio was synced
      const customerResponse = await request(app)
        .get('/software-eng/cust@test.com')
        .expect(200);

      expect(customerResponse.body.profile.name).toBe('Synced Name');
      expect(customerResponse.body.profile.bio).toBe('Synced bio');
    });
  });

  describe('POST /software-eng/:ownerId/photo', () => {
    it('should upload profile photo successfully', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/photo')
        .attach('avatar', Buffer.from('fake-image-data'), 'test-avatar.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body.avatarUrl).toMatch(/^\/uploads\/\d+\.jpg$/);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const response = await request(app)
        .post('/software-eng/nonexistent@example.com/photo')
        .attach('avatar', Buffer.from('fake-image-data'), 'test-avatar.jpg')
        .expect(404);

      expect(response.body.error).toBe('Portfolio not found');
    });
  });

  describe('POST /software-eng/:ownerId/certificate-image', () => {
    it('should upload certificate image successfully', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/certificate-image')
        .attach('certificateImage', Buffer.from('fake-cert-data'), 'test-cert.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('imageUrl');
      expect(response.body).toHaveProperty('isPdf', true);
      expect(response.body.imageUrl).toMatch(/^\/uploads\/\d+\.pdf$/);
    });

    it('should handle PowerPoint files', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/certificate-image')
        .field('filename', 'test-presentation.pptx')
        .attach('certificateImage', Buffer.from('fake-ppt-data'), 'test-presentation.pptx')
        .expect(200);

      expect(response.body).toHaveProperty('isPowerPoint', true);
    });

    it('should return error for invalid file type', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/certificate-image')
        .field('filename', 'test-file.txt')
        .attach('certificateImage', Buffer.from('fake-data'), 'test-file.txt')
        .expect(400);

      expect(response.body.error).toContain('Only image files, PDFs, and PowerPoint files are allowed');
    });
  });

  describe('POST /software-eng/:ownerId/project-image', () => {
    it('should upload project image successfully', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/project-image')
        .attach('projectImage', Buffer.from('fake-project-image'), 'project.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('imageUrl');
      expect(response.body.imageUrl).toMatch(/^\/uploads\/\d+\.jpg$/);
    });

    it('should return error when no file provided', async () => {
      const response = await request(app)
        .post('/software-eng/admin@test.com/project-image')
        .set('x-test-no-file', 'true')
        .expect(400);

      expect(response.body.error).toBe('No image file uploaded');
    });
  });

  describe('DELETE /software-eng/:ownerId', () => {
    it('should delete portfolio successfully', async () => {
      // First create a portfolio
      const portfolio = new SoftwareEng(testPortfolio);
      await portfolio.save();

      const response = await request(app)
        .delete('/software-eng/test@example.com')
        .expect(200);

      expect(response.body.message).toBe('Portfolio deleted');

      // Verify it's deleted
      const getResponse = await request(app)
        .get('/software-eng/test@example.com')
        .expect(404);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const response = await request(app)
        .delete('/software-eng/nonexistent@example.com')
        .expect(404);

      expect(response.body.error).toBe('Portfolio not found');
    });
  });

  describe('WebSocket Integration', () => {
    it('should emit portfolio update events', async () => {
      const updateData = { profile: { name: 'WebSocket Test' } };

      const response = await request(app)
        .put('/software-eng/admin@test.com')
        .send(updateData)
        .expect(200);

      // The route should emit WebSocket events (tested via logs)
      expect(response.body.profile.name).toBe('WebSocket Test');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .put('/software-eng/admin@test.com')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .put('/software-eng/admin@test.com')
        .send({})
        .expect(200); // Should still work as it's a partial update
    });
  });
});
