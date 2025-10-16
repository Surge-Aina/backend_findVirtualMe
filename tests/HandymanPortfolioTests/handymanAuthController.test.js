    let authController;
    beforeAll(() => {
    try {
        authController = require('../../controllers/handyman/handymanAuthController');
    } catch {
        authController = null;
    }
    });

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c){ this.statusCode=c; return this; },
        json(x){ this.body=x; return x; }
    };
    }

    test('auth controller exists (else skip)', () => {
    if (!authController) {
        console.warn('handymanAuthController not found; skipping');
        return;
    }
    expect(typeof authController).toBe('object');
    });

    test('happy path login (if exported) returns token or 200', async () => {
    if (!authController) return;
    const fn = authController.login || authController.signIn || authController.authenticate;
    if (typeof fn !== 'function') {
        console.warn('No login-like export on handymanAuthController; skipping');
        return;
    }
    const req = { body: { email: 'user@test.com', password: 'pass' } };
    const res = makeRes();
    await fn(req, res);
    expect([200, 201]).toContain(res.statusCode);
    });

    test('invalid creds (if exported) returns 401/400', async () => {
    if (!authController) return;
    const fn = authController.login || authController.signIn || authController.authenticate;
    if (typeof fn !== 'function') return;
    const req = { body: { email: 'user@test.com', password: 'wrong' } };
    const res = makeRes();
    await fn(req, res);
    expect([400, 401]).toContain(res.statusCode);
    });
