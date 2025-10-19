describe("signupUser", () => {
  test("dummy test just to verify setup", () => {
    expect(true).toBe(true);
  });
});

// process.env.STRIPE_SECRET_KEY_TEST = "sk_test_dummy";
// process.env.JWT_SECRET = "test_secret";

// const request = require("supertest");
// const express = require("express");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const { setupTestDB, teardownTestDB, clearTestDB } = require("../../../setup/setup.js");
// const { loginUser } = require("../../../../controllers/userController.js");
// const User = require("../../../../models/userModel.js");
// const Stripe = require("stripe");

// const app = express();
// app.use(express.json());

// jest.mock("stripe", () => {
//   return jest.fn().mockImplementation(() => ({
//     checkout: {
//       sessions: {
//         create: jest.fn().mockResolvedValue({ id: "sess_123" }),
//       },
//     },
//   }));
// });

// // Mock routes for testing
// app.post("/login", loginUser);

// // Mock JWT secret for testing
// process.env.JWT_SECRET = "test-secret-key";

// describe("User Controller", () => {
//   beforeAll(async () => {
//     await setupTestDB();
//   });

//   afterAll(async () => {
//     await teardownTestDB();
//   });

//   beforeEach(async () => {
//     await clearTestDB();
//   });

//   describe("POST /login", () => {
//     test("should login with valid credentials", async () => {
//       // Create a test user
//       const hashedPassword = await bcrypt.hash("password123", 10);
//       await User.create({
//         email: "test@example.com",
//         password: hashedPassword,
//         isAdmin: true,
//       });

//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "test@example.com",
//           password: "password123",
//         })
//         .expect(201);

//       expect(response.body).toHaveProperty("token");
//       expect(response.body.isAdmin).toBe(true);

//       // Verify token is valid
//       const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
//       expect(decoded).toHaveProperty("id");
//       expect(decoded.isAdmin).toBe(true);
//     });

//     test("should login non-admin user", async () => {
//       // Create a non-admin test user
//       const hashedPassword = await bcrypt.hash("password123", 10);
//       await User.create({
//         email: "user@example.com",
//         password: hashedPassword,
//         isAdmin: false,
//       });

//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "user@example.com",
//           password: "password123",
//         })
//         .expect(201);

//       expect(response.body).toHaveProperty("token");
//       expect(response.body.isAdmin).toBe(false);
//     });

//     test("should return 400 when email is missing", async () => {
//       const response = await request(app)
//         .post("/login")
//         .send({
//           password: "password123",
//         })
//         .expect(400);

//       expect(response.body).toEqual({
//         message: "All fields must be filled out",
//       });
//     });

//     test("should return 400 when password is missing", async () => {
//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "test@example.com",
//         })
//         .expect(400);

//       expect(response.body).toEqual({
//         message: "All fields must be filled out",
//       });
//     });

//     test("should return 400 when user does not exist", async () => {
//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "nonexistent@example.com",
//           password: "password123",
//         })
//         .expect(400);

//       expect(response.body).toEqual({
//         message: "User not found",
//       });
//     });

//     test("should return 400 with invalid password", async () => {
//       // Create a test user
//       const hashedPassword = await bcrypt.hash("correctpassword", 10);
//       await User.create({
//         email: "test@example.com",
//         password: hashedPassword,
//         isAdmin: false,
//       });

//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "test@example.com",
//           password: "wrongpassword",
//         })
//         .expect(400);

//       expect(response.body).toEqual({
//         message: "Invalid credentials",
//       });
//     });

//     test("should handle empty email and password", async () => {
//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "",
//           password: "",
//         })
//         .expect(400);

//       expect(response.body).toEqual({
//         message: "All fields must be filled out",
//       });
//     });

//     test("should handle database errors gracefully", async () => {
//       // Mock a database error
//       const originalFindOne = User.findOne;
//       User.findOne = jest.fn().mockRejectedValue(new Error("Database error"));

//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "test@example.com",
//           password: "password123",
//         })
//         .expect(500);

//       expect(response.body).toHaveProperty("error");

//       // Restore original method
//       User.findOne = originalFindOne;
//     });

//     test("should create token with correct expiration", async () => {
//       // Create a test user
//       const hashedPassword = await bcrypt.hash("password123", 10);
//       const user = await User.create({
//         email: "test@example.com",
//         password: hashedPassword,
//         isAdmin: true,
//       });

//       const response = await request(app)
//         .post("/login")
//         .send({
//           email: "test@example.com",
//           password: "password123",
//         })
//         .expect(201);

//       // Decode token and check expiration
//       const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
//       const now = Math.floor(Date.now() / 1000);
//       const sevenDaysInSeconds = 7 * 24 * 60 * 60;

//       expect(decoded.exp - decoded.iat).toBe(sevenDaysInSeconds);
//       expect(decoded.id).toBe(user._id.toString());
//     });
//   });
// });
