    // mock UserModel used by the controller to resolve email
    jest.mock('../..//models/userModel', () => ({
    findById: jest.fn().mockResolvedValue(null) // we'll rely on req.body.contact.email
    }));

    const controller = require('../..//controllers/handyman/handymanTemplateController');
    const HandymanTemplate = require('../..//models/handyMan/HandymanTemplate');

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c){ this.statusCode=c; return this; },
        json: function(x){ this.body = x; return x; }
    };
    }

    describe('HandymanTemplate Controller', () => {
    it('createPortfolio injects phone into hero.phoneNumber and uses contact.email fallback', async () => {
        const req = {
        user: { id: 'u123', userId: 'u123' }, // auth present
        body: {
            hero: { title: 'T' },
            contact: { email: 'me@me.com' }, // fallback if user lookup fails
            phone: '999-000'
        }
        };
        const res = makeRes();
        await controller.createPortfolio(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.userId).toBe('u123');
        expect(res.body.hero.phoneNumber).toBe('999-000'); // merged into hero
        expect(res.body.contact.email).toBe('me@me.com');
    });

    it('updatePortfolio deep-merges hero and contact; forbids non-owner', async () => {
        const created = await HandymanTemplate.create({
        userId: 'owner1',
        hero: { title: 'A', subtitle: 'B', phoneNumber: '111' },
        contact: { title: 'CT', phone: '123', email: 'a@a.com' }
        });

        // wrong owner → 403
        let req = { user: { id: 'other' }, params: { id: created._id }, body: { hero: { title: 'NEW' } } };
        let res = makeRes();
        await controller.updatePortfolio(req, res);
        expect(res.statusCode).toBe(403);

        // correct owner → deep-merge, preserve previous fields
        req = { user: { id: 'owner1' }, params: { id: created._id }, body: { hero: { title: 'NEW' }, contact: { phone: '999' } } };
        res = makeRes();
        await controller.updatePortfolio(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.hero.subtitle).toBe('B'); // preserved
        expect(res.body.hero.title).toBe('NEW');  // updated
        expect(res.body.contact.email).toBe('a@a.com'); // preserved
        expect(res.body.contact.phone).toBe('999');     // updated
    });

    it('getPortfolioById / listPortfolios work', async () => {
        const a = await HandymanTemplate.create({ userId: 'u1' });
        await HandymanTemplate.create({ userId: 'u2' });

        let req = { params: { id: a._id } }, res = makeRes();
        await controller.getPortfolioById(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.body._id.toString()).toBe(a._id.toString());

        req = { query: { userId: 'u2' } }; res = makeRes();
        await controller.listPortfolios(req, res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.every(d => d.userId === 'u2')).toBe(true);
    });

    // listPortfolios with no matches
    it('listPortfolios returns empty array when no matches', async () => {
        const req = { query: { userId: 'no-such-user' } };
        const res = { body:null, statusCode:200, status(c){ this.statusCode=c; return this; }, json(x){ this.body=x; return x; } };
        await controller.listPortfolios(req, res);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });

    // updatePortfolio invalid payload (no user in req -> 401 handled already)
    // also check 403 path by creating doc with different owner
    it('updatePortfolio -> 403 when not owner', async () => {
        const doc = await HandymanTemplate.create({ userId: 'owner1', hero:{}, contact:{} });
        const req = { user: { id: 'not-owner' }, params: { id: doc._id }, body: { hero: { title: 'x' } } };
        const res = { statusCode:200, body:null, status(c){ this.statusCode=c; return this; }, json(x){ this.body=x; return x; } };
        await controller.updatePortfolio(req, res);
        expect(res.statusCode).toBe(403);
    });

    it('createPortfolio requires auth', async () => {
        const req = { user: null, body: {} }, res = makeRes();
        await controller.createPortfolio(req, res);
        expect(res.statusCode).toBe(401);
    });

    //
    // NEW: a couple of small, stable branches to bump function/branch %
    //
    it('getPortfolioById -> invalid ObjectId string yields 500 (CastError path)', async () => {
        const req = { params: { id: 'not-a-valid-objectid' } };
        const res = makeRes();
        await controller.getPortfolioById(req, res);
        expect(res.statusCode).toBe(500);
    });

    it('listPortfolios -> no filters still returns an array', async () => {
        await HandymanTemplate.create({ userId: 'ux1' });
        const req = { query: {} };
        const res = makeRes();
        await controller.listPortfolios(req, res);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
    });
