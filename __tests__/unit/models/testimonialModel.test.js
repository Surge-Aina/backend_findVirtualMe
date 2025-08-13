const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Testimonial = require('../../../models/testimonialModel');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Testimonial.deleteMany({});
});

describe('Testimonial Model', () => {
  describe('Schema Validation', () => {
    it('should create testimonial with required fields', async () => {
      const testimonialData = {
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      };

      const testimonial = new Testimonial(testimonialData);
      await testimonial.save();

      expect(testimonial.name).toBe('John Doe');
      expect(testimonial.email).toBe('john@example.com');
      expect(testimonial.rating).toBe(5);
      expect(testimonial.review).toBe('Great service!');
      expect(testimonial.isApproved).toBe(false);
      expect(testimonial.createdAt).toBeInstanceOf(Date);
      expect(testimonial.updatedAt).toBeInstanceOf(Date);
    });

    it('should set default values correctly', async () => {
      const testimonial = new Testimonial({
        name: 'Jane Smith',
        email: 'jane@example.com',
        rating: 4,
        review: 'Good service'
      });

      await testimonial.save();

      expect(testimonial.isApproved).toBe(false);
      expect(testimonial.createdAt).toBeInstanceOf(Date);
      expect(testimonial.updatedAt).toBeInstanceOf(Date);
    });

    it('should trim whitespace from name and email', async () => {
      const testimonial = new Testimonial({
        name: '  John Doe  ',
        email: '  john@example.com  ',
        rating: 5,
        review: 'Great service!'
      });

      await testimonial.save();

      expect(testimonial.name).toBe('John Doe');
      expect(testimonial.email).toBe('john@example.com');
    });

    it('should convert email to lowercase', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        rating: 5,
        review: 'Great service!'
      });

      await testimonial.save();

      expect(testimonial.email).toBe('john@example.com');
    });
  });

  describe('Validation Rules', () => {
    it('should require name field', async () => {
      const testimonial = new Testimonial({
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    it('should require email field', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        rating: 5,
        review: 'Great service!'
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should require rating field', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        review: 'Great service!'
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.rating).toBeDefined();
    });

    it('should require review field', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.review).toBeDefined();
    });

    it('should validate rating range (1-5)', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 6,
        review: 'Great service!'
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.rating).toBeDefined();
    });

    it('should validate minimum rating (1)', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 0,
        review: 'Great service!'
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.rating).toBeDefined();
    });

    it('should validate review length (max 1000 characters)', async () => {
      const longReview = 'a'.repeat(1001);
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: longReview
      });

      let error;
      try {
        await testimonial.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.review).toBeDefined();
    });

    it('should accept review with exactly 1000 characters', async () => {
      const review = 'a'.repeat(1000);
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: review
      });

      await testimonial.save();
      expect(testimonial.review).toBe(review);
    });
  });

  describe('Middleware', () => {
    it('should update updatedAt field before saving', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      });

      const originalUpdatedAt = testimonial.updatedAt;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await testimonial.save();
      
      expect(testimonial.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should update updatedAt when document is modified', async () => {
      const testimonial = await Testimonial.create({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      });

      const originalUpdatedAt = testimonial.updatedAt;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      testimonial.isApproved = true;
      await testimonial.save();
      
      expect(testimonial.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(testimonial.isApproved).toBe(true);
    });
  });

  describe('Data Types', () => {
    it('should handle valid rating values', async () => {
      const ratings = [1, 2, 3, 4, 5];
      
      for (const rating of ratings) {
        const testimonial = new Testimonial({
          name: 'John Doe',
          email: 'john@example.com',
          rating: rating,
          review: 'Great service!'
        });

        await testimonial.save();
        expect(testimonial.rating).toBe(rating);
      }
    });

    it('should handle boolean isApproved field', async () => {
      const approvedTestimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!',
        isApproved: true
      });

      const pendingTestimonial = new Testimonial({
        name: 'Jane Smith',
        email: 'jane@example.com',
        rating: 4,
        review: 'Good service',
        isApproved: false
      });

      await approvedTestimonial.save();
      await pendingTestimonial.save();

      expect(approvedTestimonial.isApproved).toBe(true);
      expect(pendingTestimonial.isApproved).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should set createdAt and updatedAt on creation', async () => {
      const testimonial = new Testimonial({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      });

      await testimonial.save();

      expect(testimonial.createdAt).toBeInstanceOf(Date);
      expect(testimonial.updatedAt).toBeInstanceOf(Date);
      expect(testimonial.createdAt.getTime()).toBeCloseTo(testimonial.updatedAt.getTime(), 0);
    });

    it('should only update updatedAt on modification', async () => {
      const testimonial = await Testimonial.create({
        name: 'John Doe',
        email: 'john@example.com',
        rating: 5,
        review: 'Great service!'
      });

      const originalCreatedAt = testimonial.createdAt;
      const originalUpdatedAt = testimonial.updatedAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      testimonial.isApproved = true;
      await testimonial.save();

      expect(testimonial.createdAt.getTime()).toBe(originalCreatedAt.getTime());
      expect(testimonial.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
