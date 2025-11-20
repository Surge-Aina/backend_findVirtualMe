describe("signupUser", () => {
  test("dummy test just to verify setup", () => {
    expect(true).toBe(true);
  });
});

// const { setupTestDB, teardownTestDB, clearTestDB } = require("../../../setup/setup.js");
// const User = require("../../../../models/userModel.js");
// const bcrypt = require("bcrypt");

// describe("User Model", () => {
//   beforeAll(async () => {
//     await setupTestDB();
//   });

//   afterAll(async () => {
//     await teardownTestDB();
//   });

//   beforeEach(async () => {
//     await clearTestDB();
//   });

//   describe("Schema validation", () => {
//     test("should create a user with valid data", async () => {
//       const userData = {
//         email: "test@example.com",
//         password: "hashedpassword123",
//         isAdmin: true,
//       };

//       const user = new User(userData);
//       const savedUser = await user.save();

//       expect(savedUser.email).toBe("test@example.com");
//       expect(savedUser.password).toBe("hashedpassword123");
//       expect(savedUser.isAdmin).toBe(true);
//       expect(savedUser._id).toBeDefined();
//     });

//     test("should create user with default isAdmin false", async () => {
//       const userData = {
//         email: "user@example.com",
//         password: "hashedpassword123",
//       };

//       const user = new User(userData);
//       const savedUser = await user.save();

//       expect(savedUser.isAdmin).toBe(false);
//     });

//     test("should fail validation without email", async () => {
//       const userData = {
//         password: "hashedpassword123",
//         isAdmin: false,
//       };

//       const user = new User(userData);

//       await expect(user.save()).rejects.toThrow();
//     });

//     test("should fail validation without password", async () => {
//       const userData = {
//         email: "test@example.com",
//         isAdmin: false,
//       };

//       const user = new User(userData);

//       await expect(user.save()).rejects.toThrow();
//     });

//     test("should enforce unique email constraint", async () => {
//       const userData = {
//         email: "unique@example.com",
//         password: "password1",
//       };

//       // Create first user
//       const user1 = new User(userData);
//       await user1.save();

//       // Try to create second user with same email
//       const user2 = new User({
//         email: "unique@example.com",
//         password: "password2",
//       });

//       await expect(user2.save()).rejects.toThrow();
//     });

//     test("should accept any string as email (no format validation)", async () => {
//       const emails = [
//         "valid@example.com",
//         "invalid-email",
//         "test@domain",
//         "user123@site.co.uk",
//       ];

//       for (let i = 0; i < emails.length; i++) {
//         const user = new User({
//           email: emails[i],
//           password: `password${i}`,
//         });

//         const savedUser = await user.save();
//         expect(savedUser.email).toBe(emails[i]);
//       }
//     });

//     test("should accept valid email formats", async () => {
//       const validEmails = [
//         "test@example.com",
//         "user.name@domain.co.uk",
//         "user+tag@example.org",
//         "user123@test-domain.com",
//       ];

//       for (let i = 0; i < validEmails.length; i++) {
//         const user = new User({
//           email: validEmails[i],
//           password: `password${i}`,
//         });

//         const savedUser = await user.save();
//         expect(savedUser.email).toBe(validEmails[i]);
//       }
//     });

//     test("should handle boolean isAdmin values", async () => {
//       // Test true
//       const adminUser = new User({
//         email: "admin@example.com",
//         password: "password123",
//         isAdmin: true,
//       });
//       const savedAdmin = await adminUser.save();
//       expect(savedAdmin.isAdmin).toBe(true);

//       // Test false
//       const regularUser = new User({
//         email: "user@example.com",
//         password: "password123",
//         isAdmin: false,
//       });
//       const savedUser = await regularUser.save();
//       expect(savedUser.isAdmin).toBe(false);
//     });
//   });

//   describe("Database operations", () => {
//     test("should find user by email", async () => {
//       await User.create({
//         email: "find@example.com",
//         password: "password123",
//         isAdmin: false,
//       });

//       const found = await User.findOne({ email: "find@example.com" });
//       expect(found).toBeTruthy();
//       expect(found.email).toBe("find@example.com");
//     });

//     test("should update user", async () => {
//       const user = await User.create({
//         email: "update@example.com",
//         password: "oldpassword",
//         isAdmin: false,
//       });

//       const updated = await User.findByIdAndUpdate(
//         user._id,
//         { isAdmin: true },
//         { new: true }
//       );

//       expect(updated.isAdmin).toBe(true);
//     });

//     test("should delete user", async () => {
//       const user = await User.create({
//         email: "delete@example.com",
//         password: "password123",
//         isAdmin: false,
//       });

//       await User.findByIdAndDelete(user._id);

//       const found = await User.findById(user._id);
//       expect(found).toBeNull();
//     });

//     test("should find all users", async () => {
//       await User.create([
//         { email: "user1@example.com", password: "pass1", isAdmin: false },
//         { email: "user2@example.com", password: "pass2", isAdmin: true },
//         { email: "user3@example.com", password: "pass3", isAdmin: false },
//       ]);

//       const allUsers = await User.find({});
//       expect(allUsers).toHaveLength(3);

//       const emails = allUsers.map((u) => u.email);
//       expect(emails).toContain("user1@example.com");
//       expect(emails).toContain("user2@example.com");
//       expect(emails).toContain("user3@example.com");
//     });

//     test("should find admin users only", async () => {
//       await User.create([
//         { email: "admin1@example.com", password: "pass1", isAdmin: true },
//         { email: "user1@example.com", password: "pass2", isAdmin: false },
//         { email: "admin2@example.com", password: "pass3", isAdmin: true },
//       ]);

//       const adminUsers = await User.find({ isAdmin: true });
//       expect(adminUsers).toHaveLength(2);

//       adminUsers.forEach((user) => {
//         expect(user.isAdmin).toBe(true);
//       });
//     });
//   });

//   describe("Password handling", () => {
//     test("should store hashed passwords correctly", async () => {
//       const plainPassword = "mySecretPassword123";
//       const hashedPassword = await bcrypt.hash(plainPassword, 10);

//       const user = await User.create({
//         email: "hash@example.com",
//         password: hashedPassword,
//         isAdmin: false,
//       });

//       // Verify password is hashed
//       expect(user.password).not.toBe(plainPassword);
//       expect(user.password).toBe(hashedPassword);

//       // Verify password can be compared
//       const isValid = await bcrypt.compare(plainPassword, user.password);
//       expect(isValid).toBe(true);

//       const isInvalid = await bcrypt.compare("wrongpassword", user.password);
//       expect(isInvalid).toBe(false);
//     });
//   });
// });
