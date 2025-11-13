    // Keep tests fast & deterministic
    jest.setTimeout(10000);

    // 1) Mock multer so upload.fields(...) is a no-op middleware
    jest.mock('multer', () => {
  // one real middleware to use everywhere
    const mw = (req, res, next) => next();
    const multerFn = () => ({
        fields: () => mw,  // was returning a factory before; must return middleware
        single: () => mw,
        array:  () => mw,
        none:   () => mw,
    });
    multerFn.memoryStorage = () => ({});
    return multerFn;
    });

    // 2) Mock user model used by auth (so Bearer auth passes when needed)
    jest.mock('../../models/userModel', () => ({
    findById: jest.fn().mockResolvedValue({ _id: '656f9f9f9f9f9f9f9f9f9f9f', email: 'u@test.com' }),
    }), { virtual: true });

    // 3) Mock ALL three controllers so routes never hit DB/files
    jest.mock('../../controllers/handyman/handymanInquiryController', () => ({
    createInquiry: (req, res) => res.status(201).json({ ok: true, got: req.body || {} }),
    }), { virtual: true });

    jest.mock('../../controllers/handyman/handymanPortfolioController', () => ({
    getPortfolioItems: (req, res) => res.json([]),
    createPortfolioItem: (req, res) => res.status(201).json({ id: 'p1' }),
    updatePortfolioItem: (req, res) => res.json({ id: req.params.id, updated: true }),
    deletePortfolioItem: (req, res) => res.json({ ok: true }),
    }), { virtual: true });

    jest.mock('../../controllers/handyman/handymanTemplateController', () => ({
    listPortfolios: (req, res) => res.json([]),
    getPortfolioById: (req, res) => res.json({ id: req.params.id }),
    createPortfolio: (req, res) =>
        res.status(201).json({ id: 't1', userId: req.user?.id || req.user?.userId }),
    updatePortfolio: (req, res) =>
        res.json({ id: req.params.id, userId: req.user?.id || req.user?.userId, updated: true }),
    }), { virtual: true });

    // 4) Now require deps and routes (must be AFTER mocks above)
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

    const express = require('express');
    const request = require('supertest');
    const jwt = require('jsonwebtoken');

    const inquiryRoutes = require('../../routes/handyMan/handymanInquiryRoutes');
    const portfolioRoutes = require('../../routes/handyMan/handymanPortfolioRoutes');
    const templateRoutes = require('../../routes/handyMan/handymanTemplateRoutes');

    function makeApp() {
    const app = express();
    app.set('env', 'test');
    app.use(express.json());
    app.use('/handyman/inquiries', inquiryRoutes);
    app.use('/handyman/portfolio-items', portfolioRoutes);
    app.use('/handyman/templates', templateRoutes);
    app.use((req, res) => res.status(404).json({ message: 'not found' }));
    return app;
    }

    describe('Handyman routes smoke tests', () => {
    const app = makeApp();
    const SECRET = process.env.JWT_SECRET;

    test('POST /handyman/inquiries -> hits controller and returns 201', async () => {
        const res = await request(app).post('/handyman/inquiries').send({ email: 'a@a.com' });
        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
    });

    test('GET /handyman/portfolio-items -> list', async () => {
        const res = await request(app).get('/handyman/portfolio-items');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /handyman/portfolio-items -> create', async () => {
        const res = await request(app)
        .post('/handyman/portfolio-items')
        .field('title', 'X')
        .field('category', 'Y')
        .field('templateId', 't1')
        // we can attach files or not—controller is mocked and ignores them
        .attach('beforeImage', Buffer.from('a'), { filename: 'a.jpg' })
        .attach('afterImage', Buffer.from('b'), { filename: 'b.jpg' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('p1');
    });

    test('PUT /handyman/portfolio-items/:id -> update', async () => {
        const res = await request(app).put('/handyman/portfolio-items/abc123').field('title', 'Updated');
        expect(res.status).toBe(200);
        expect(res.body.updated).toBe(true);
    });

    test('DELETE /handyman/portfolio-items/:id -> delete', async () => {
        const res = await request(app).delete('/handyman/portfolio-items/abc123');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('GET /handyman/templates -> public list', async () => {
        const res = await request(app).get('/handyman/templates');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /handyman/templates/:id -> public read', async () => {
        const res = await request(app).get('/handyman/templates/xyz');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('xyz');
    });

    test('POST /handyman/templates -> 401 without Bearer', async () => {
        const res = await request(app).post('/handyman/templates').send({ hero: {}, contact: {} });
        expect(res.status).toBe(401);
    });

    test('POST /handyman/templates -> 201 with Bearer token', async () => {
        const token = jwt.sign({ id: '656f9f9f9f9f9f9f9f9f9f9f' }, SECRET, { expiresIn: '1h' });
        const res = await request(app)
        .post('/handyman/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ hero: {}, contact: {} });
        expect(res.status).toBe(201);
        expect(res.body.id).toBe('t1');
    });

    test('PUT /handyman/templates/:id -> 200 with Bearer token', async () => {
        const token = jwt.sign({ id: '656f9f9f9f9f9f9f9f9f9f9f' }, SECRET, { expiresIn: '1h' });
        const res = await request(app)
        .put('/handyman/templates/abc')
        .set('Authorization', `Bearer ${token}`)
        .send({ hero: { title: 'New' } });
        expect(res.status).toBe(200);
        expect(res.body.updated).toBe(true);
    });
    });
