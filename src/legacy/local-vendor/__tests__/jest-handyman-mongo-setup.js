    jest.setTimeout(240000); // 4 min

    process.env.MONGOMS_START_TIMEOUT = '120000';
    const path = require('path');
    process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '6.0.6';
    process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '.mongodb-binaries');
    const fs = require('fs');
    const mongoose = require('mongoose');
    const { MongoMemoryServer } = require('mongodb-memory-server');

    let mongo;

    // cache binaries *inside tests/* to avoid root lock issues
    const BIN_VERSION = process.env.MONGOMS_VERSION || '6.0.6';
    const binDir = path.resolve(__dirname, '.mongodb-binaries');
    const lockFile = path.join(binDir, `${BIN_VERSION}.lock`);

    // remove stale lock if present
    try { if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true }); } catch {}

    beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
        binary: {
        version: BIN_VERSION,
        downloadDir: binDir,
        },
        instance: { dbName: 'handyman_test' },
        autoStart: true,
    });

    const uri = mongo.getUri();
    await mongoose.connect(uri, { dbName: 'handyman_test' });
    });

    afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
    jest.clearAllMocks();
    });

    afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    });
