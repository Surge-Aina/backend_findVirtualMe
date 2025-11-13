    // Virtual mock for user lookup
    jest.mock('../../models/userModel', () => ({
    findById: jest.fn().mockResolvedValue(null)
    }), { virtual: true });

    const controller = require('../../controllers/handyman/handymanTemplateController');
    const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');

    // ---- Mongoose static method mocks (no real DB) ----
    beforeEach(() => {
    jest.restoreAllMocks();

    // create -> return a synthesized doc
    jest.spyOn(HandymanTemplate, 'create').mockImplementation(async (doc) => ({
        ...doc,
        _id: 'mock-id-1',
        toObject() { return this; }
    }));

    // findById -> returns a "doc"
    jest.spyOn(HandymanTemplate, 'findById').mockImplementation(async (id) => {
        if (id === 'not-found') return null;
        if (String(id).startsWith('not-a-valid-objectid')) throw new Error('CastError');
        return {
        _id: id,
        userId: 'owner1',
        hero: { title: 'A', subtitle: 'B', phoneNumber: '111' },
        contact: { title: 'CT', phone: '123', email: 'a@a.com' },
        toObject() { return this; }
        };
    });

    // find -> chain .sort().resolve([...])
    jest.spyOn(HandymanTemplate, 'find').mockImplementation((query = {}) => ({
        sort: jest.fn().mockResolvedValue(
        [
            { _id: 'p1', userId: 'u1' },
            { _id: 'p2', userId: 'u2' }
        ].filter(d => !query.userId || d.userId === query.userId)
        )
    }));

    // findByIdAndUpdate -> merge existing & update
    jest.spyOn(HandymanTemplate, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        if (String(id) === 'not-found') return null;
        const existing = await HandymanTemplate.findById(id);
        if (!existing) return null;
        return {
        ...existing,
        ...update,
        hero: { ...(existing.hero || {}), ...(update.hero || {}) },
        contact: { ...(existing.contact || {}), ...(update.contact || {}) }
        };
    });
    });

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c){ this.statusCode=c; return this; },
        json(x){ this.body = x; return x; }
    };
    }

    describe('HandymanTemplate Controller', () => {
    it('createPortfolio injects phone into hero.phoneNumber and uses contact.email fallback', async () => {
        const req = {
        user: { id: 'u123', userId: 'u123' },
        body: { hero: { title: 'T' }, contact: { email: 'me@me.com' }, phone: '999-000' }
        };
        const res = makeRes();
        await controller.createPortfolio(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.userId).toBe('u123');
        expect(res.body.hero.phoneNumber).toBe('999-000');
        expect(res.body.contact.email).toBe('me@me.com');
    });

    it('updatePortfolio deep-merges hero and contact; forbids non-owner', async () => {
        // wrong owner
        let req = { user: { id: 'other' }, params: { id: 'abc' }, body: { hero: { title: 'NEW' } } };
        let res = makeRes();
        await controller.updatePortfolio(req, res);
        expect(res.statusCode).toBe(403);

        // correct owner
        req = { user: { id: 'owner1' }, params: { id: 'abc' }, body: { hero: { title: 'NEW' }, contact: { phone: '999' } } };
        res = makeRes();
        await controller.updatePortfolio(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.hero.subtitle).toBe('B'); // preserved
        expect(res.body.hero.title).toBe('NEW');  // updated
        expect(res.body.contact.email).toBe('a@a.com'); // preserved
        expect(res.body.contact.phone).toBe('999');     // updated
    });

    it('getPortfolioById / listPortfolios work', async () => {
        let req = { params: { id: 'abc' } }, res = makeRes();
        await controller.getPortfolioById(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.body._id.toString()).toBe('abc');

        req = { query: { userId: 'u2' } }; res = makeRes();
        await controller.listPortfolios(req, res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.every(d => d.userId === 'u2')).toBe(true);
    });

    it('listPortfolios returns empty array when no matches', async () => {
        const req = { query: { userId: 'no-such-user' } };
        const res = makeRes();
        await controller.listPortfolios(req, res);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });

    it('createPortfolio requires auth', async () => {
        const req = { user: null, body: {} }, res = makeRes();
        await controller.createPortfolio(req, res);
        expect(res.statusCode).toBe(401);
    });

    it('getPortfolioById -> invalid ObjectId string yields 500 (CastError path)', async () => {
        // simulate CastError by throwing inside controller call
        jest.spyOn(HandymanTemplate, 'findById').mockRejectedValueOnce(new Error('CastError'));
        const req = { params: { id: 'not-a-valid-objectid' } };
        const res = makeRes();
        await controller.getPortfolioById(req, res);
        expect(res.statusCode).toBe(500);
    });

    it('listPortfolios -> no filters still returns an array', async () => {
        const req = { query: {} };
        const res = makeRes();
        await controller.listPortfolios(req, res);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
    });
