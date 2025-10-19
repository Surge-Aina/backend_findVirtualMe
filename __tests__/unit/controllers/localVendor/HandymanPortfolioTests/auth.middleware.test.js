    // tests/HandymanPortfolioTests/auth.middleware.test.js
    const jwt = require('jsonwebtoken');

    describe('middleware/auth.js', () => {
    let auth;

    // Make sure the secret your middleware reads matches what we sign with.
    // Do this BEFORE requiring the middleware so it picks up the env.
    beforeAll(() => {
        if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'unit-test-secret';
        }
        jest.resetModules();
        auth = require('../../middleware/auth');
    });

    const makeRes = () => ({
        statusCode: 200,
        body: null,
        status(n) { this.statusCode = n; return this; },
        json(obj) { this.body = obj; return this; },
    });

    test('exports a function', () => {
        expect(typeof auth).toBe('function');
    });

    test('valid JWT -> calls next()', async () => {
        // Sign a real token using the SAME secret the middleware will use
        const token = jwt.sign(
        { id: '656f9f9f9f9f9f9f9f9f9f9f', role: 'tester' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
        );

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = makeRes();
        const next = jest.fn();

        // Middleware may be sync or async; await covers both
        await auth(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(req.user || req.auth || req.account).toBeTruthy();
    });

    test('missing token -> 401', async () => {
        const req = { headers: {} };
        const res = makeRes();
        const next = jest.fn();

        await auth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Missing token' });
    });

    test('invalid token -> 401', async () => {
        // A clearly invalid token string
        const req = { headers: { authorization: 'Bearer not-a-real-token' } };
        const res = makeRes();
        const next = jest.fn();

        await auth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid token' });
    });
    });
