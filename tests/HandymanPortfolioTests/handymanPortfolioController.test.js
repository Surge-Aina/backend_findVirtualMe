    const controller = require('../../controllers/handyman/handymanPortfolioController');
    const HandymanPortfolio = require('../../models/handyMan/handymanPortfolioModel');

    // mock S3 service used by controller (default: success)
    jest.mock('../../services/s3Service', () => ({
    uploadToS3: jest.fn(async (buf, name, mime, prefix) => ({
        url: `https://s3.test/${prefix}/fake-${name}`,
        key: `${prefix}/fake-${name}`
    })),
    deleteFromS3: jest.fn(async (key) => ({ ok: true, key }))
    }));
    const s3 = require('../../services/s3Service');

    function makeRes(){
    return {
        statusCode: 200,
        body: null,
        status(c){ this.statusCode=c; return this; },
        json(x){ this.body = x; return x; }
    };
    }

    describe('Handyman Portfolio Items', () => {
    it('createPortfolioItem uploads both images and saves keys', async () => {
        const req = {
        body: {
            title: 'Kitchen',
            subtitle: 'Makeover',
            category: 'Remodel',
            templateId: '656f9f9f9f9f9f9f9f9f9f9f'
        },
        files: {
            beforeImage: [{ buffer: Buffer.from('a'), originalname: 'before.jpg', mimetype: 'image/jpeg' }],
            afterImage:  [{ buffer: Buffer.from('b'), originalname: 'after.jpg',  mimetype: 'image/jpeg'  }]
        }
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
        const created = await HandymanPortfolio.create({
        templateId: '656f9f9f9f9f9f9f9f9f9f9f',
        title: 'Door',
        category: 'Fix',
        beforeImageUrl: 'https://s3.test/Ports/HandyMan/oldA.jpg',
        afterImageUrl:  'https://s3.test/Ports/HandyMan/oldB.jpg'
        });

        const req = {
        params: { id: created._id.toString() },
        body: {
            beforeImageUrl: 'https://s3.amazonaws.com/bucket/Ports/HandyMan/newA.jpg',
            afterImageUrl:  'https://s3.amazonaws.com/bucket/Ports/HandyMan/newB.jpg'
        },
        files: {}
        };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.beforeImageKey).toMatch(/Ports\/HandyMan\/newA\.jpg$/);
        expect(res.body.afterImageKey).toMatch(/Ports\/HandyMan\/newB\.jpg$/);
    });

    it('deletePortfolioItem removes S3 objects and DB record', async () => {
        const item = await HandymanPortfolio.create({
        templateId: '656f9f9f9f9f9f9f9f9f9f9f',
        title: 'Yard',
        category: 'Clean',
        beforeImageUrl: 'https://s3.test/Ports/HandyMan/x.jpg',
        afterImageUrl:  'https://s3.test/Ports/HandyMan/y.jpg'
        });

        const req = { params: { id: item._id.toString() } };
        const res = makeRes();
        await controller.deletePortfolioItem(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });

        const found = await HandymanPortfolio.findById(item._id);
        expect(found).toBeNull();

        expect(s3.deleteFromS3).toHaveBeenCalledTimes(2);
    });

    it('updatePortfolioItem returns 404 for missing item', async () => {
        const req = {
        params: { id: '6588b4d0f0f0f0f0f0f0f0f0' }, // non-existent ObjectId
        body: { title: 'Nope' },
        files: {}
        };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);
        expect(res.statusCode).toBe(404);
    });

    it('createPortfolioItem rejects when only one image is provided (before only)', async () => {
        const req = {
        body: { title: 'X', category: 'Y', templateId: 't1' },
        files: {
            beforeImage: [{ buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' }]
            // afterImage missing
        }
        };
        const res = makeRes();
        await controller.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(400);
    });

    it('deletePortfolioItem returns 404 when id not found', async () => {
        const req = { params: { id: '6588b4d0f0f0f0f0f0f0f0f0' } };
        const res = makeRes();
        await controller.deletePortfolioItem(req, res);
        expect(res.statusCode).toBe(404);
    });

    // invalid ObjectId path (current code catches CastError -> 500)
    it('updatePortfolioItem with invalid id returns 500 (CastError path)', async () => {
        const req = { params: { id: 'not-a-valid-objectid' }, body: { title: 'x' }, files: {} };
        const res = makeRes();
        await controller.updatePortfolioItem(req, res);
        expect(res.statusCode).toBe(500); // current implementation
    });

    // upload error path: make s3 upload throw, expect 500
    describe('createPortfolioItem -> upload fails after first image', () => {
        beforeEach(() => {
        jest.resetModules();
        });

        it('responds 500 when second upload fails', async () => {
        jest.doMock('../../services/s3Service', () => {
            let call = 0;
            return {
            uploadToS3: jest.fn(async (buf, name, mime, prefix) => {
                call += 1;
                if (call === 1) {
                return { url: `https://s3.test/${prefix}/ok-${name}`, key: `${prefix}/ok-${name}` };
                }
                throw new Error('s3 down on second upload');
            }),
            deleteFromS3: jest.fn(async () => ({ ok: true }))
            };
        });
        const ctrl = require('../../controllers/handyman/handymanPortfolioController');

        const req = {
            body: { title: 'X', category: 'Y', templateId: 't1' },
            files: {
            beforeImage: [{ buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg' }],
            afterImage:  [{ buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg' }]
            }
        };
        const res = makeRes();

        await ctrl.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(500);
        // no assertion about cleanup since controller may not attempt it
        });
    });

    it('createPortfolioItem rejects when missing before/after', async () => {
        const req = {
        body: { title: 'X', category: 'Y', templateId: 't1' },
        files: {} // missing both images
        };
        const res = makeRes();
        await controller.createPortfolioItem(req, res);
        expect(res.statusCode).toBe(400);
    });
    });
