const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');


let mongod;


async function setupMemoryMongo() {
mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
const uri = mongod.getUri();
await mongoose.connect(uri, {
dbName: 'testdb',
});
}


async function dropMemoryMongo(scope = 'db') {
if (!mongoose.connection.readyState) return;
if (scope === 'collections') {
const collections = await mongoose.connection.db.collections();
for (const c of collections) await c.deleteMany({});
} else if (scope === 'db') {
await mongoose.connection.dropDatabase();
}
}


async function stopMemoryMongo() {
await mongoose.disconnect();
if (mongod) await mongod.stop();
}


module.exports = { setupMemoryMongo, dropMemoryMongo, stopMemoryMongo };