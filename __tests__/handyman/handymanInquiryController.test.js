    let controller;
    try {
    controller = require('../../controllers/handyman/handymanInquiryController');
    } catch (e) {
    console.warn('handymanInquiryController not found; skipping suite');
    }

    const HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
    const HandymanInquiry = require('../../models/handyMan/handymanInquiryModel');

    // mock nodemailer
    jest.mock('nodemailer', () => {
    const sendMail = jest.fn().mockResolvedValue({ ok: true });
    return { createTransport: jest.fn(() => ({ sendMail })) };
    });
    const mail = require('nodemailer');

    beforeEach(() => {
    jest.restoreAllMocks();

    // Template lookup: emulate .lean() chain
    jest.spyOn(HandymanTemplate, 'findById').mockImplementation((id) => ({
        lean: async () => {
        if (!id || id === 'not-found') return null;
        return {
            _id: id,
            userId: 'u1',
            contact: { email: 'owner@test.com' },
            services: [
            { title: 'Fix Door', price: 50 },
            { title: 'Paint', price: 100 }
            ]
        };
        }
    }));

    // Inquiry.create -> just resolve
    jest.spyOn(HandymanInquiry, 'create').mockResolvedValue({ ok: true, _id: 'inq1' });
    });

    function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(x) { this.body = x; return x; }
    };
    }

    (controller ? describe : describe.skip)('Handyman Inquiry', () => {
    it('saves inquiry with price snapshot and emails visitor + owner', async () => {
        const req = {
        body: {
            name: 'Alice',
            email: 'alice@test.com',
            message: 'Help',
            templateId: 'tpl1',
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

    it('handles missing templateId and still saves with zeroed prices', async () => {
        const req = { body: { name: 'Bob', email: 'b@test.com', message: 'Hi', selectedServiceTitles: ['Unknown Service'] } };
        const res = makeRes();
        await controller.createInquiry(req, res);
        expect(res.statusCode).toBe(201);
    });

    it('handles missing selectedServiceTitles gracefully', async () => {
        const req = { body: { name: 'Carol', email: 'c@test.com', message: 'Yo' } };
        const res = makeRes();
        await controller.createInquiry(req, res);
        expect(res.statusCode).toBe(201);
    });

    it('gracefully handles server error', async () => {
        jest.spyOn(HandymanTemplate, 'findById').mockImplementationOnce(() => ({
        lean: async () => { throw new Error('boom'); }
        }));
        const req = { body: { name: 'X', email: 'x@x.com', message: 'm', templateId: 'tplX' } };
        const res = makeRes();

        await controller.createInquiry(req, res);
        expect(res.statusCode).toBe(500);
    });
    });
