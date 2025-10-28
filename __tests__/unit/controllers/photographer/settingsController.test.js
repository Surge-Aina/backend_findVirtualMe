describe("signupUser", () => {
  test("dummy test just to verify setup", () => {
    expect(true).toBe(true);
  });
});

// const request = require("supertest");
// const express = require("express");
// const { setupTestDB, teardownTestDB, clearTestDB } = require("../../setup.js");
// const {
//   getSetting,
//   updateSetting,
//   getAllSettings,
// } = require("../../../controllers/settingsController.js");
// const Settings = require("../../../models/settingsModel.js");

// const app = express();
// app.use(express.json());

// // Mock routes for testing
// app.get("/settings/:key", getSetting);
// app.put("/settings/:key", updateSetting);
// app.get("/settings", getAllSettings);

// describe("Settings Controller", () => {
//   beforeAll(async () => {
//     await setupTestDB();
//   });

//   afterAll(async () => {
//     await teardownTestDB();
//   });

//   beforeEach(async () => {
//     await clearTestDB();
//   });

//   describe("GET /settings/:key", () => {
//     test("should get an existing setting", async () => {
//       // Create a test setting
//       await Settings.create({
//         key: "testKey",
//         value: "testValue",
//       });

//       const response = await request(app).get("/settings/testKey").expect(200);

//       expect(response.body).toEqual({
//         key: "testKey",
//         value: "testValue",
//       });
//     });

//     test("should return 404 for non-existent setting", async () => {
//       const response = await request(app).get("/settings/nonExistentKey").expect(404);

//       expect(response.body).toEqual({
//         error: "Setting not found",
//       });
//     });
//   });

//   describe("PUT /settings/:key", () => {
//     test("should create a new setting", async () => {
//       const response = await request(app)
//         .put("/settings/newKey")
//         .send({ value: "newValue" })
//         .expect(200);

//       expect(response.body).toEqual({
//         key: "newKey",
//         value: "newValue",
//       });

//       // Verify it was saved to database
//       const savedSetting = await Settings.findOne({ key: "newKey" });
//       expect(savedSetting.value).toBe("newValue");
//     });

//     test("should update an existing setting", async () => {
//       // Create initial setting
//       await Settings.create({
//         key: "existingKey",
//         value: "oldValue",
//       });

//       const response = await request(app)
//         .put("/settings/existingKey")
//         .send({ value: "updatedValue" })
//         .expect(200);

//       expect(response.body).toEqual({
//         key: "existingKey",
//         value: "updatedValue",
//       });

//       // Verify it was updated in database
//       const updatedSetting = await Settings.findOne({ key: "existingKey" });
//       expect(updatedSetting.value).toBe("updatedValue");
//     });

//     test("should handle complex object values", async () => {
//       const complexValue = {
//         services: ["wedding", "portrait"],
//         pricing: { basic: 100, premium: 200 },
//         enabled: true,
//       };

//       const response = await request(app)
//         .put("/settings/complexKey")
//         .send({ value: complexValue })
//         .expect(200);

//       expect(response.body.value).toEqual(complexValue);
//     });

//     test("should return 400 when value is missing", async () => {
//       const response = await request(app).put("/settings/testKey").send({}).expect(400);

//       expect(response.body).toEqual({
//         error: "Value is required",
//       });
//     });

//     test("should handle special values", async () => {
//       // Test zero value
//       const zeroResponse = await request(app)
//         .put("/settings/zeroKey")
//         .send({ value: 0 })
//         .expect(200);

//       expect(zeroResponse.body.value).toBe(0);

//       // Test false value
//       const falseResponse = await request(app)
//         .put("/settings/falseKey")
//         .send({ value: false })
//         .expect(200);

//       expect(falseResponse.body.value).toBe(false);
//     });
//   });

//   describe("GET /settings", () => {
//     test("should return all settings as an object", async () => {
//       // Create multiple test settings
//       await Settings.create([
//         { key: "setting1", value: "value1" },
//         { key: "setting2", value: { nested: "object" } },
//         { key: "setting3", value: ["array", "values"] },
//       ]);

//       const response = await request(app).get("/settings").expect(200);

//       expect(response.body).toEqual({
//         setting1: "value1",
//         setting2: { nested: "object" },
//         setting3: ["array", "values"],
//       });
//     });

//     test("should return empty object when no settings exist", async () => {
//       const response = await request(app).get("/settings").expect(200);

//       expect(response.body).toEqual({});
//     });
//   });

//   describe("Error handling", () => {
//     test("should handle database errors gracefully", async () => {
//       // Mock a database error by closing the connection
//       const originalFind = Settings.findOne;
//       Settings.findOne = jest.fn().mockRejectedValue(new Error("Database error"));

//       const response = await request(app).get("/settings/testKey").expect(500);

//       expect(response.body).toEqual({
//         error: "Failed to get setting",
//       });

//       // Restore original method
//       Settings.findOne = originalFind;
//     });
//   });
// });
