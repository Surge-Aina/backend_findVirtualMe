    // tests/HandymanPortfolioTests/handymanTemplateRoutes.test.js
    const express = require('express');
    const request = require('supertest');
    const mongoose = require('mongoose');
    const { MongoMemoryServer } = require('mongodb-memory-server');

    const templateRouter = require('../../routes/handymanTemplateRoutes');
    const HandymanTemplate = require('../../models/HandymanTemplate');

    function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/handyman-template', templateRouter);
    return app;
    }

    describe('Handyman Template API', () => {
    let app;
    let mongo;

    // If your tests sometimes take longer on Windows/CI
    jest.setTimeout(60000);

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        const uri = mongo.getUri();

        // optional, but avoids Mongoose deprecation warnings
        mongoose.set('strictQuery', false);

        await mongoose.connect(uri, {
        dbName: 'testdb',
        });
    });

    afterAll(async () => {
        await mongoose.disconnect();
        if (mongo) await mongo.stop();
    });

    beforeEach(() => {
        app = makeApp();
    });

    afterEach(async () => {
        // Clean DB between tests to avoid cross-test pollution
        const { collections } = mongoose.connection;
        const ops = Object.values(collections).map((c) => c.deleteMany({}));
        await Promise.all(ops);
    });

    test('GET /api/handyman-template/:id → 200 with portfolio data', async () => {
        const doc = await HandymanTemplate.create({
        userId: new mongoose.Types.ObjectId(),
        hero: { title: 'Initial Title', subtitle: 'Init sub', phoneNumber: '(111) 111-1111' },
        });

        const res = await request(app).get(`/api/handyman-template/${doc._id}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('_id', doc._id.toString());
        expect(res.body).toHaveProperty('hero');
        expect(res.body.hero).toHaveProperty('title', 'Initial Title');
        expect(Array.isArray(res.body.services)).toBe(true);
    });

    test('GET /api/handyman-template/:id → 404 when not found', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/api/handyman-template/${fakeId}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message || res.body.error).toMatch(/not found/i);
    });

    test('GET /api/handyman-template/:bad → 500 for invalid id', async () => {
        const res = await request(app).get('/api/handyman-template/not-a-valid-id');
        expect(res.statusCode).toBe(500);
        expect((res.body.message || '') + (res.body.error || '')).toMatch(/error/i);
    });

    test('PUT /api/handyman-template/:id → 200 updates hero title', async () => {
        const doc = await HandymanTemplate.create({
        userId: new mongoose.Types.ObjectId(),
        hero: { title: 'Old Title', subtitle: 'Sub', phoneNumber: '(111) 111-1111' },
        });

        const res = await request(app)
        .put(`/api/handyman-template/${doc._id}`)
        .send({ hero: { title: 'New Title' } });

        expect(res.statusCode).toBe(200);
        expect(res.body.hero.title).toBe('New Title');

        const inDb = await HandymanTemplate.findById(doc._id);
        expect(inDb.hero.title).toBe('New Title');
    });

    test('PUT /api/handyman-template/:id → 404 for missing doc', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
        .put(`/api/handyman-template/${fakeId}`)
        .send({ hero: { title: 'X' } });
        expect(res.statusCode).toBe(404);
        expect(res.body.message || res.body.error).toMatch(/not found/i);
    });

    test('PUT /api/handyman-template/:id → 500 on validation error (bad services)', async () => {
        const doc = await HandymanTemplate.create({
        userId: new mongoose.Types.ObjectId(),
        hero: { title: 'T', subtitle: 'S', phoneNumber: '(111) 111-1111' },
        services: [{ name: 'Good', icon: '🔧' }],
        });

        const res = await request(app)
        .put(`/api/handyman-template/${doc._id}`)
        .send({ services: [{ icon: '💡' }] }); // invalid: missing name

        expect(res.statusCode).toBe(500);
        expect((res.body.message || '') + (res.body.error || '')).toMatch(/error/i);

        const inDb = await HandymanTemplate.findById(doc._id);
        expect(inDb.services[0].name).toBe('Good');
    });
    });
