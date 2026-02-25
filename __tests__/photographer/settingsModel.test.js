describe("signupUser", () => {
  test("dummy test just to verify setup", () => {
    expect(true).toBe(true);
  });
});

// const { setupTestDB, teardownTestDB, clearTestDB } = require("../../setup.js");
// const Settings = require("../../../models/settingsModel.js");

// describe("Settings Model", () => {
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
//     test("should create a setting with valid data", async () => {
//       const settingData = {
//         key: "testKey",
//         value: "testValue",
//       };

//       const setting = new Settings(settingData);
//       const savedSetting = await setting.save();

//       expect(savedSetting.key).toBe("testKey");
//       expect(savedSetting.value).toBe("testValue");
//       expect(savedSetting.updatedAt).toBeInstanceOf(Date);
//       expect(savedSetting._id).toBeDefined();
//     });

//     test("should fail validation without key", async () => {
//       const settingData = {
//         value: "testValue",
//       };

//       const setting = new Settings(settingData);

//       await expect(setting.save()).rejects.toThrow();
//     });

//     test("should fail validation without value", async () => {
//       const settingData = {
//         key: "testKey",
//       };

//       const setting = new Settings(settingData);

//       await expect(setting.save()).rejects.toThrow();
//     });

//     test("should enforce unique key constraint", async () => {
//       const settingData = {
//         key: "uniqueKey",
//         value: "value1",
//       };

//       // Create first setting
//       const setting1 = new Settings(settingData);
//       await setting1.save();

//       // Try to create second setting with same key
//       const setting2 = new Settings({
//         key: "uniqueKey",
//         value: "value2",
//       });

//       await expect(setting2.save()).rejects.toThrow();
//     });

//     test("should handle different value types", async () => {
//       const testCases = [
//         { key: "stringValue", value: "test string" },
//         { key: "numberValue", value: 42 },
//         { key: "booleanValue", value: true },
//         { key: "booleanFalse", value: false },
//         { key: "arrayValue", value: ["item1", "item2", "item3"] },
//         { key: "objectValue", value: { nested: { property: "value" } } },
//         { key: "emptyArray", value: [] },
//         { key: "emptyObject", value: {} },
//       ];

//       for (const testCase of testCases) {
//         const setting = new Settings(testCase);
//         const savedSetting = await setting.save();

//         expect(savedSetting.key).toBe(testCase.key);
//         expect(savedSetting.value).toEqual(testCase.value);
//       }
//     });

//     test("should automatically set updatedAt on creation", async () => {
//       const before = new Date();

//       const setting = new Settings({
//         key: "timeTest",
//         value: "test",
//       });

//       const savedSetting = await setting.save();
//       const after = new Date();

//       expect(savedSetting.updatedAt).toBeInstanceOf(Date);
//       expect(savedSetting.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
//       expect(savedSetting.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
//     });

//     test("should update updatedAt when modified", async () => {
//       // Create initial setting
//       const setting = new Settings({
//         key: "updateTest",
//         value: "initial",
//       });
//       const savedSetting = await setting.save();
//       const initialUpdatedAt = savedSetting.updatedAt;

//       // Wait a bit to ensure timestamp difference
//       await new Promise((resolve) => setTimeout(resolve, 10));

//       // Update the setting
//       savedSetting.value = "updated";
//       savedSetting.updatedAt = new Date();
//       const updatedSetting = await savedSetting.save();

//       expect(updatedSetting.updatedAt.getTime()).toBeGreaterThan(
//         initialUpdatedAt.getTime()
//       );
//     });
//   });

//   describe("Database operations", () => {
//     test("should find setting by key", async () => {
//       await Settings.create({
//         key: "findTest",
//         value: "findValue",
//       });

//       const found = await Settings.findOne({ key: "findTest" });
//       expect(found).toBeTruthy();
//       expect(found.value).toBe("findValue");
//     });

//     test("should update setting using findOneAndUpdate", async () => {
//       await Settings.create({
//         key: "updateTest",
//         value: "original",
//       });

//       const updated = await Settings.findOneAndUpdate(
//         { key: "updateTest" },
//         { value: "modified", updatedAt: new Date() },
//         { new: true }
//       );

//       expect(updated.value).toBe("modified");
//     });

//     test("should create new setting with upsert", async () => {
//       const upserted = await Settings.findOneAndUpdate(
//         { key: "newKey" },
//         { value: "newValue", updatedAt: new Date() },
//         { upsert: true, new: true }
//       );

//       expect(upserted.key).toBe("newKey");
//       expect(upserted.value).toBe("newValue");
//     });

//     test("should delete setting", async () => {
//       const setting = await Settings.create({
//         key: "deleteTest",
//         value: "toDelete",
//       });

//       await Settings.findByIdAndDelete(setting._id);

//       const found = await Settings.findById(setting._id);
//       expect(found).toBeNull();
//     });

//     test("should find all settings", async () => {
//       await Settings.create([
//         { key: "setting1", value: "value1" },
//         { key: "setting2", value: "value2" },
//         { key: "setting3", value: "value3" },
//       ]);

//       const allSettings = await Settings.find({});
//       expect(allSettings).toHaveLength(3);

//       const keys = allSettings.map((s) => s.key);
//       expect(keys).toContain("setting1");
//       expect(keys).toContain("setting2");
//       expect(keys).toContain("setting3");
//     });
//   });
// });
