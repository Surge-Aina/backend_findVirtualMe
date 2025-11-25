const express = require('express');
const request = require('supertest');
const { generateMatchSummary } = require('../../services/openAiService');
const router = require('../../routes/projectManager/openAiRoute.js'); // Adjust path to your route file

// Mock the OpenAI service
jest.mock('../../services/openAiService');

describe('Match Summary Route Tests', () => {
  let app;

  beforeAll(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/match', router); // Adjust base path as needed
  });

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  // ============================================
  // POST /summary - SUCCESS CASES
  // ============================================
  describe('POST /api/match/summary - Success Cases', () => {
    it('should return summary when valid input is provided', async () => {
      const mockSummary = `
        ✓ Matches: JavaScript, React, Node.js
        ✗ Missing: Python, AWS
        Summary: Strong frontend developer with relevant skills.
      `;

      generateMatchSummary.mockResolvedValue(mockSummary);

      const requestBody = {
        resumeJSON: {
          name: 'John Doe',
          skills: ['JavaScript', 'React', 'Node.js'],
          experience: [
            { company: 'Tech Corp', title: 'Developer', years: 3 },
          ],
        },
        jobText: 'Looking for a JavaScript developer with React experience.',
      };

      const res = await request(app)
        .post('/api/match/summary')
        .send(requestBody)
        .expect(200);

      expect(res.body).toEqual({ summary: mockSummary });
      expect(generateMatchSummary).toHaveBeenCalledWith(
        requestBody.resumeJSON,
        requestBody.jobText
      );
      expect(generateMatchSummary).toHaveBeenCalledTimes(1);
    });

    it('should handle complex resume JSON with multiple fields', async () => {
      const complexResumeJSON = {
        name: 'Jane Smith',
        title: 'Senior Developer',
        email: 'jane@example.com',
        skills: ['Java', 'Python', 'AWS', 'Docker', 'Kubernetes'],
        experience: [
          {
            company: 'Tech Corp',
            title: 'Lead Engineer',
            duration: '5 years',
            description: 'Led development team',
          },
          {
            company: 'StartUp Inc',
            title: 'Developer',
            duration: '2 years',
          },
        ],
        education: [
          {
            degree: 'BS Computer Science',
            school: 'MIT',
            year: 2015,
          },
        ],
      };

      const mockSummary = 'Excellent match for senior position';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: complexResumeJSON,
          jobText: 'Senior position requiring Java and AWS',
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
      expect(generateMatchSummary).toHaveBeenCalledWith(
        complexResumeJSON,
        expect.any(String)
      );
    });

    it('should handle long job descriptions', async () => {
      const longJobText = 'Requirements: ' + 'A'.repeat(5000);
      const mockSummary = 'Summary for long job description';

      generateMatchSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test User', skills: ['JavaScript'] },
          jobText: longJobText,
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
    });

    it('should handle empty arrays in resumeJSON', async () => {
      const mockSummary = 'Limited experience';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: {
            name: 'New Grad',
            skills: [],
            experience: [],
            education: [],
          },
          jobText: 'Entry level position',
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
    });

    it('should return proper JSON content-type header', async () => {
      generateMatchSummary.mockResolvedValue('Summary');

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: 'Job text',
        });

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ============================================
  // POST /summary - VALIDATION ERRORS
  // ============================================
  describe('POST /api/match/summary - Validation Errors', () => {
    it('should return 400 if resumeJSON is missing', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          jobText: 'Some job description',
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
      expect(generateMatchSummary).not.toHaveBeenCalled();
    });

    it('should return 400 if jobText is missing', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'John Doe', skills: ['JavaScript'] },
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
      expect(generateMatchSummary).not.toHaveBeenCalled();
    });

    it('should return 400 if both inputs are missing', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({})
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
      expect(generateMatchSummary).not.toHaveBeenCalled();
    });

    it('should return 400 if resumeJSON is null', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: null,
          jobText: 'Job description',
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
    });

    it('should return 400 if jobText is null', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: null,
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
    });

    it('should return 400 if resumeJSON is empty string', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: '',
          jobText: 'Job text',
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
    });

    it('should return 400 if jobText is empty string', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: '',
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'Missing input' });
    });

  
  });

  // ============================================
  // POST /summary - SERVICE ERRORS
  // ============================================
  describe('POST /api/match/summary - Service Errors', () => {
    it('should return 500 if generateMatchSummary throws error', async () => {
      generateMatchSummary.mockRejectedValue(new Error('OpenAI API Error'));

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'John Doe', skills: ['JavaScript'] },
          jobText: 'Job description',
        })
        .expect(500);

      expect(res.body).toEqual({ error: 'Generation failed' });
      expect(console.error).toHaveBeenCalled();
    });

    it('should return 500 on rate limit error', async () => {
      generateMatchSummary.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test User' },
          jobText: 'Test job description',
        })
        .expect(500);

      expect(res.body).toEqual({ error: 'Generation failed' });
    });

    it('should return 500 on network timeout', async () => {
      generateMatchSummary.mockRejectedValue(new Error('Network timeout'));

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: 'Test',
        })
        .expect(500);

      expect(res.body.error).toBe('Generation failed');
    });

    it('should log error details to console.error', async () => {
      const testError = new Error('Specific test error');
      generateMatchSummary.mockRejectedValue(testError);

      await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: 'Test',
        });

      expect(console.error).toHaveBeenCalledWith(testError);
    });

    it('should handle API authentication errors', async () => {
      generateMatchSummary.mockRejectedValue(
        new Error('Invalid API key')
      );

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: 'Test',
        })
        .expect(500);

      expect(res.body.error).toBe('Generation failed');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe('POST /api/match/summary - Edge Cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const res = await request(app)
        .post('/api/match/summary')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      // Express will return 400 for malformed JSON
      expect(res.status).toBe(400);
    });

    it('should handle special characters in job text', async () => {
      const mockSummary = 'Summary generated';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const specialJobText = 'Job with <html> & special © chars™ 日本語';

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: { name: 'Test' },
          jobText: specialJobText,
        })
        .expect(200);

      expect(generateMatchSummary).toHaveBeenCalledWith(
        expect.any(Object),
        specialJobText
      );
    });

    it('should handle Unicode characters in resume', async () => {
      const mockSummary = 'Summary';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: {
            name: '張三',
            skills: ['プログラミング'],
          },
          jobText: 'Job description',
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
    });

    it('should handle very large resume JSON', async () => {
      const mockSummary = 'Summary for large resume';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const largeResumeJSON = {
        name: 'Test User',
        skills: Array(100).fill('Skill'),
        experience: Array(50).fill({
          company: 'Company',
          title: 'Title',
          description: 'Description',
        }),
      };

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: largeResumeJSON,
          jobText: 'Job',
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
    });

    it('should handle resumeJSON with nested objects', async () => {
      const mockSummary = 'Summary';
      generateMatchSummary.mockResolvedValue(mockSummary);

      const nestedResumeJSON = {
        name: 'Test',
        contact: {
          email: 'test@example.com',
          phone: '123-456-7890',
          address: {
            street: '123 Main St',
            city: 'San Francisco',
          },
        },
        skills: ['JavaScript'],
      };

      const res = await request(app)
        .post('/api/match/summary')
        .send({
          resumeJSON: nestedResumeJSON,
          jobText: 'Job',
        })
        .expect(200);

      expect(res.body.summary).toBe(mockSummary);
    });
  });
});