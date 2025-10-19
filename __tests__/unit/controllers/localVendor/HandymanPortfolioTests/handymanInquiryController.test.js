    const controller = require('../../controllers/handyman/handymanInquiryController');
    const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');

    // mock nodemailer
    jest.mock('nodemailer', () => {
    const sendMail = jest.fn().mockResolvedValue({ ok: true });
    return {
        createTransport: jest.fn(() => ({ sendMail }))
    };
    });
    const mail = require('nodemailer');

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(x) { this.body = x; return x; }
    };
    }

    describe('Handyman Inquiry', () => {
    it('saves inquiry with price snapshot and emails visitor + owner', async () => {
        const t = await HandymanTemplate.create({
        userId: 'u1',
        services: [
            { title: 'Fix Door', price: 50 },
            { title: 'Paint', price: 100 }
        ],
        contact: { email: 'owner@test.com' }
        });

        const req = {
        body: {
            name: 'Alice',
            email: 'alice@test.com',
            message: 'Help',
            templateId: t._id.toString(),
            selectedServiceTitles: ['Fix Door', 'Paint']
        }
        };
        const res = makeRes();
        await controller.createInquiry(req, res);

        expect(res.statusCode).toBe(201);
        expect(mail.createTransport).toHaveBeenCalled();
        const transport = mail.createTransport.mock.results[0].value;
        expect(transport.sendMail).toHaveBeenCalledTimes(2);
    });

    it('handles missing templateId (or not found) and still saves with zeroed prices', async () => {
        const req = {
        body: {
            name: 'Bob',
            email: 'b@test.com',
            message: 'Hi',
            // no templateId
            selectedServiceTitles: ['Unknown Service']
        }
        };
        const res = makeRes();
        await controller.createInquiry(req, res);
        expect(res.statusCode).toBe(201);
    });

    it('handles missing selectedServiceTitles gracefully', async () => {
        const req = {
        body: {
            name: 'Carol',
            email: 'c@test.com',
            message: 'Yo'
        }
        };
        const res = makeRes();
        await controller.createInquiry(req, res);
        expect(res.statusCode).toBe(201);
    });

    it('gracefully handles server error', async () => {
        // Force the code path that queries a template by providing a templateId
        const fakeId = '656f9f9f9f9f9f9f9f9f9f9f';

        // Mock the full query chain: findById(...).select(...).lean() -> throws
        const spy = jest
        .spyOn(HandymanTemplate, 'findById')
        .mockImplementation(() => ({
            select: () => ({
            lean: async () => { throw new Error('boom'); }
            })
        }));

        const req = { body: { name: 'X', email: 'x@x.com', message: 'm', templateId: fakeId } };
        const res = makeRes();

        await controller.createInquiry(req, res);

        expect(res.statusCode).toBe(500);

        spy.mockRestore();
    });
    });
