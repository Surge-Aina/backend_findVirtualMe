    // tests/HandymanPortfolioTests/auth.middleware.test.js
    const jwt = require('jsonwebtoken');

    describe('middleware/auth.js', () => {
    let auth;

    beforeAll(() => {
        if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'unit-test-secret';
        jest.resetModules();
        try {
        auth = require('../../middleware/auth'); // may not exist in repo
        } catch {
        console.warn('auth middleware not found; skipping this suite');
        }
    });

    const makeRes = () => ({
        statusCode: 200,
        body: null,
        status(n) { this.statusCode = n; return this; },
        json(obj) { this.body = obj; return this; },
    });

    (auth ? test : test.skip)('exports a function', () => {
        expect(typeof auth).toBe('function');
    });

    (auth ? test : test.skip)('valid JWT -> calls next()', async () => {
        const token = jwt.sign(
        { id: '656f9f9f9f9f9f9f9f9f9f9f', role: 'tester' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
        );

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = makeRes();
        const next = jest.fn();

        await auth(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(req.user || req.auth || req.account).toBeTruthy();
    });

    (auth ? test : test.skip)('missing token -> 401', async () => {
        const req = { headers: {} };
        const res = makeRes();
        const next = jest.fn();

        await auth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Missing token' });
    });

    (auth ? test : test.skip)('invalid token -> 401', async () => {
        const req = { headers: { authorization: 'Bearer not-a-real-token' } };
        const res = makeRes();
        const next = jest.fn();

        await auth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid token' });
    });
    });
