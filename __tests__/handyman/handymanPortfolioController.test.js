    // __tests__/handyman/handymanPortfolioController.test.js

    // 1) Mock S3 BEFORE requiring the controller (and use the correct path)
    jest.mock('../../services/s3Service', () => ({
    uploadToS3: jest.fn(async (_buf, name, _mime, prefix) => ({
        url: `https://s3.test/${prefix}/fake-${name}`,
        key: `${prefix}/fake-${name}`,
    })),
    deleteFromS3: jest.fn(async (_key) => ({ ok: true })),
    }), { virtual: true });

    const s3 = require('../../services/s3Service');

    // 2) Now safely require controller & model
    const controller = require('../../controllers/handyman/handymanPortfolioController');
    const HandymanPortfolio = require('../../models/handyMan/handymanPortfolioModel');

    // ---- Mongoose static method mocks (no real DB) ----
    beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(HandymanPortfolio, 'create').mockImplementation(async (doc) => ({
        ...doc,
        _id: 'hp1',
        toObject() { return this; },
    }));

    jest.spyOn(HandymanPortfolio, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
        if (id === 'missing') return null;
        return { _id: id, ...update };
    });

    jest.spyOn(HandymanPortfolio, 'findById').mockImplementation(async (id) => {
        if (id === 'missing') return null;
        return {
        _id: id,
        beforeImageUrl: 'https://s3.test/Ports/HandyMan/x.jpg',
        afterImageUrl: 'https://s3.test/Ports/HandyMan/y.jpg',
        beforeImageKey: 'Ports/HandyMan/x.jpg',
        afterImageKey: 'Ports/HandyMan/y.jpg',
        toObject() { return this; },
        };
    });

    jest.spyOn(HandymanPortfolio, 'findByIdAndDelete').mockResolvedValue({ ok: true });
    });

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(x) { this.body = x; return x; },
    };
    }

    describe('Handyman Portfolio Items', () => {
    it('createPortfolioItem uploads both images and saves keys', async () => {
        const req = {
        body: { title: 'Kitchen', subtitle: 'Makeover', category: 'Remodel', templateId: 't1' },
        files: {
            beforeImage: [{ buffer: Buffer.from('a'), originalname: 'before.jpg', mimetype: 'image/jpeg' }],
            afterImage:  [{ buffer: Buffer.from('b'), originalname: 'after.jpg',  mimetype: 'image/jpeg'  }],
        },
        };
        const res = makeRes();
        await controller.createPortfolioItem(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.title).toBe('Kitchen');
        expect(res.body.beforeImageKey).toMatch(/Ports\/HandyMan\/fake-before.jpg/);
        expect(res.body.afterImageKey).toMatch(/Ports\/HandyMan\/fake-after.jpg/);
        expect(s3.uploadToS3).toHaveBeenCalledTimes(2);
    });

    it('updatePortfolioItem derives keys from URLs when keys missing', async () => {
        const req = {
        params: { id: 'hp1' },
        body: {
            beforeImageUrl: 'https://s3.amazonaws.com/bucket/Ports/HandyMan/newA.jpg',
            afterImageUrl:  'https://s3.amazonaws.com/bucket/Ports/HandyMan/newB.jpg',
        },
        files: {},
        };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.beforeImageKey).toMatch(/Ports\/HandyMan\/newA\.jpg$/);
        expect(res.body.afterImageKey).toMatch(/Ports\/HandyMan\/newB\.jpg$/);
    });

    it('deletePortfolioItem removes S3 objects and DB record', async () => {
        const req = { params: { id: 'hp-del' } };
        const res = makeRes();
        await controller.deletePortfolioItem(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(s3.deleteFromS3).toHaveBeenCalledTimes(2);
    });

    it('updatePortfolioItem returns 404 for missing item', async () => {
        jest.spyOn(HandymanPortfolio, 'findByIdAndUpdate').mockResolvedValueOnce(null);
        const req = { params: { id: 'missing' }, body: { title: 'Nope' }, files: {} };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);
        expect(res.statusCode).toBe(404);
    });

    it('createPortfolioItem rejects when only one image is provided (before only)', async () => {
        const req = {
        body: { title: 'X', category: 'Y', templateId: 't1' },
        files: { beforeImage: [{ buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' }] },
        };
        const res = makeRes();
        await controller.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(400);
    });

    it('deletePortfolioItem returns 404 when id not found', async () => {
        jest.spyOn(HandymanPortfolio, 'findById').mockResolvedValueOnce(null);
        const req = { params: { id: 'missing' } };
        const res = makeRes();
        await controller.deletePortfolioItem(req, res);
        expect(res.statusCode).toBe(404);
    });

    it('updatePortfolioItem with invalid id returns 500 (CastError path)', async () => {
        jest.spyOn(HandymanPortfolio, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('CastError'));
        const req = { params: { id: 'not-a-valid-objectid' }, body: { title: 'x' }, files: {} };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);
        expect(res.statusCode).toBe(500);
    });

    describe('createPortfolioItem -> upload fails after first image', () => {
        beforeEach(() => jest.resetModules());

        it('responds 500 when second upload fails', async () => {
        jest.doMock('../../services/s3Service', () => {
            let call = 0;
            return {
            uploadToS3: jest.fn(async (_buf, name, _mime, prefix) => {
                call += 1;
                if (call === 1) return { url: `https://s3.test/${prefix}/ok-${name}`, key: `${prefix}/ok-${name}` };
                throw new Error('s3 down on second upload');
            }),
            deleteFromS3: jest.fn(async () => ({ ok: true })),
            };
        }, { virtual: true });

        const ctrl = require('../../controllers/handyman/handymanPortfolioController');
        const req = {
            body: { title: 'X', category: 'Y', templateId: 't1' },
            files: {
            beforeImage: [{ buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' }],
            afterImage:  [{ buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg' }],
            },
        };
        const res = makeRes();

        await ctrl.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(500);
        });
    });

    it('createPortfolioItem rejects when missing before/after', async () => {
        const req = { body: { title: 'X', category: 'Y', templateId: 't1' }, files: {} };
        const res = makeRes();
        await controller.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(400);
    });
    });
