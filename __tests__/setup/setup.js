const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup before all tests
const setupTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
};

// Cleanup after all tests
const teardownTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
};

// Clear database between tests
const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

module.exports = { setupTestDB, teardownTestDB, clearTestDB };

// Dummy test to prevent Jest from complaining about empty test suite
describe('Test Setup', () => {
  test('should export test utilities', () => {
    expect(typeof setupTestDB).toBe('function');
    expect(typeof teardownTestDB).toBe('function');
    expect(typeof clearTestDB).toBe('function');
  });
});
