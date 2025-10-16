describe("signupUser", () => {
  test("dummy test just to verify setup", () => {
    expect(true).toBe(true);
  });
});

// const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server');
// const Testimonial = require('../../../models/testimonialModel');
// const testimonialController = require('../../../controllers/testimonialController');

// let mongoServer;

// // Mock response and request objects
// const mockResponse = () => {
//   const res = {};
//   res.status = jest.fn().mockReturnValue(res);
//   res.json = jest.fn().mockReturnValue(res);
//   return res;
// };

// const mockRequest = (body = {}, params = {}) => ({
//   body,
//   params
// });

// beforeAll(async () => {
//   mongoServer = await MongoMemoryServer.create();
//   await mongoose.connect(mongoServer.getUri());
// });

// afterAll(async () => {
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

// beforeEach(async () => {
//   await Testimonial.deleteMany({});
// });

// describe('Testimonial Controller', () => {
//   describe('getApprovedTestimonials', () => {
//     it('should return only approved testimonials', async () => {
//       const approvedTestimonial = await Testimonial.create({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: 'Great service!',
//         isApproved: true
//       });

//       const pendingTestimonial = await Testimonial.create({
//         name: 'Jane Smith',
//         email: 'jane@example.com',
//         rating: 4,
//         review: 'Good service',
//         isApproved: false
//       });

//       const req = mockRequest();
//       const res = mockResponse();

//       await testimonialController.getApprovedTestimonials(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith([expect.objectContaining({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: 'Great service!',
//         isApproved: true
//       })]);
//     });

//     it('should return empty array when no approved testimonials', async () => {
//       await Testimonial.create({
//         name: 'Jane Smith',
//         email: 'jane@example.com',
//         rating: 4,
//         review: 'Good service',
//         isApproved: false
//       });

//       const req = mockRequest();
//       const res = mockResponse();

//       await testimonialController.getApprovedTestimonials(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith([]);
//     });
//   });

//   describe('getTopTestimonials', () => {
//     it('should return top 3 approved testimonials', async () => {
//       const testimonials = await Testimonial.create([
//         {
//           name: 'John Doe',
//           email: 'john@example.com',
//           rating: 5,
//           review: 'Great service!',
//           isApproved: true,
//           createdAt: new Date('2024-01-01')
//         },
//         {
//           name: 'Jane Smith',
//           email: 'jane@example.com',
//           rating: 4,
//           review: 'Good service',
//           isApproved: true,
//           createdAt: new Date('2024-01-02')
//         },
//         {
//           name: 'Bob Johnson',
//           email: 'bob@example.com',
//           rating: 5,
//           review: 'Excellent!',
//           isApproved: true,
//           createdAt: new Date('2024-01-03')
//         },
//         {
//           name: 'Alice Brown',
//           email: 'alice@example.com',
//           rating: 3,
//           review: 'Okay service',
//           isApproved: true,
//           createdAt: new Date('2024-01-04')
//         }
//       ]);

//       const req = mockRequest();
//       const res = mockResponse();

//       await testimonialController.getTopTestimonials(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
//         expect.objectContaining({ name: 'Alice Brown' }),
//         expect.objectContaining({ name: 'Bob Johnson' }),
//         expect.objectContaining({ name: 'Jane Smith' })
//       ]));
//     });
//   });

//   describe('submitTestimonial', () => {
//     it('should create a new testimonial', async () => {
//       const testimonialData = {
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: 'Great service!'
//       };

//       const req = mockRequest(testimonialData);
//       const res = mockResponse();

//       await testimonialController.submitTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(201);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Testimonial submitted successfully! It will be reviewed before being published.'
//       });
//     });

//     it('should validate required fields', async () => {
//       const req = mockRequest({
//         name: 'John Doe',
//         email: 'john@example.com'
//         // Missing rating and review
//       });
//       const res = mockResponse();

//       await testimonialController.submitTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(400);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'All fields are required'
//       });
//     });

//     it('should validate rating range', async () => {
//       const req = mockRequest({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 6, // Invalid rating
//         review: 'Great service!'
//       });
//       const res = mockResponse();

//       await testimonialController.submitTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(400);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Rating must be between 1 and 5'
//       });
//     });

//     it('should validate review length', async () => {
//       const longReview = 'a'.repeat(1001); // Too long
//       const req = mockRequest({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: longReview
//       });
//       const res = mockResponse();

//       await testimonialController.submitTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(400);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Review must be less than 1000 characters'
//       });
//     });
//   });

//   describe('getAllTestimonials', () => {
//     it('should return all testimonials for admin', async () => {
//       const testimonials = await Testimonial.create([
//         {
//           name: 'John Doe',
//           email: 'john@example.com',
//           rating: 5,
//           review: 'Great service!',
//           isApproved: true
//         },
//         {
//           name: 'Jane Smith',
//           email: 'jane@example.com',
//           rating: 4,
//           review: 'Good service',
//           isApproved: false
//         }
//       ]);

//       const req = mockRequest();
//       const res = mockResponse();

//       await testimonialController.getAllTestimonials(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
//         expect.objectContaining({ name: 'John Doe' }),
//         expect.objectContaining({ name: 'Jane Smith' })
//       ]));
//     });
//   });

//   describe('updateTestimonialApproval', () => {
//     it('should update testimonial approval status', async () => {
//       const testimonial = await Testimonial.create({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: 'Great service!',
//         isApproved: false
//       });

//       const req = mockRequest(
//         { isApproved: true },
//         { id: testimonial._id.toString() }
//       );
//       const res = mockResponse();

//       await testimonialController.updateTestimonialApproval(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith(
//         expect.objectContaining({
//           _id: testimonial._id,
//           isApproved: true
//         })
//       );
//     });

//     it('should return 404 if testimonial not found', async () => {
//       const fakeId = new mongoose.Types.ObjectId();
//       const req = mockRequest(
//         { isApproved: true },
//         { id: fakeId.toString() }
//       );
//       const res = mockResponse();

//       await testimonialController.updateTestimonialApproval(req, res);

//       expect(res.status).toHaveBeenCalledWith(404);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Testimonial not found'
//       });
//     });
//   });

//   describe('deleteTestimonial', () => {
//     it('should delete existing testimonial', async () => {
//       const testimonial = await Testimonial.create({
//         name: 'John Doe',
//         email: 'john@example.com',
//         rating: 5,
//         review: 'Great service!'
//       });

//       const req = mockRequest({}, { id: testimonial._id.toString() });
//       const res = mockResponse();

//       await testimonialController.deleteTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(200);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Testimonial deleted successfully'
//       });
//     });

//     it('should return 404 if testimonial not found', async () => {
//       const fakeId = new mongoose.Types.ObjectId();
//       const req = mockRequest({}, { id: fakeId.toString() });
//       const res = mockResponse();

//       await testimonialController.deleteTestimonial(req, res);

//       expect(res.status).toHaveBeenCalledWith(404);
//       expect(res.json).toHaveBeenCalledWith({
//         message: 'Testimonial not found'
//       });
//     });
//   });
// });
