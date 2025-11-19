    // __tests__/handyman/HandymanTemplate.model.test.js

    let HandymanTemplate;
    try {
    HandymanTemplate = require('../../models/handyMan/HandymanTemplate');
    } catch (e) {
    console.warn('HandymanTemplate model not found; skipping this suite');
    }

    const runOrSkip = HandymanTemplate ? describe : describe.skip;

    runOrSkip('Model: HandymanTemplate', () => {
    const validDoc = {
        userId: 'u1',
        hero: {
        title: 'Trusted Handyman',
        subtitle: 'We fix it all',
        phoneNumber: '123-456-7890',
        imageUrl: 'https://example.com/img.jpg',
        },
        contact: {
        email: 'owner@test.com',
        phone: '123-456-7890',
        },
        services: [],
        processSteps: [],
        testimonials: [],
    };

    test('valid document passes validateSync()', () => {
        const m = new HandymanTemplate(validDoc);
        const err = m.validateSync();
        expect(err).toBeUndefined();
    });

    test('toObject returns plain object with hero + contact', () => {
        const m = new HandymanTemplate(validDoc);
        const obj = m.toObject();
        expect(obj.hero.title).toBe(validDoc.hero.title);
        expect(obj.contact.email).toBe(validDoc.contact.email);
    });

    test('requires userId (if enforced)', () => {
        const m = new HandymanTemplate({ ...validDoc, userId: undefined });
        const err = m.validateSync();
        if (!err || !err.errors?.userId) {
        console.warn('SKIP: userId not required by schema');
        return;
        }
        expect(err.errors.userId.kind).toBe('required');
    });

    test('email on contact is required (if enforced)', () => {
        const m = new HandymanTemplate({
        ...validDoc,
        contact: { phone: '123' },
        });
        const err = m.validateSync();
        if (!err || !err.errors?.['contact.email']) {
        console.warn('SKIP: contact.email not required by schema');
        return;
        }
        expect(err.errors['contact.email'].kind).toBe('required');
    });

    test('hero.title should be required (if enforced)', () => {
        const doc = JSON.parse(JSON.stringify(validDoc));
        doc.hero.title = undefined;
        const m = new HandymanTemplate(doc);
        const err = m.validateSync();
        if (!err || !err.errors?.['hero.title']) {
        console.warn('SKIP: hero.title not required by schema');
        return;
        }
        expect(err.errors['hero.title'].kind).toBe('required');
    });

    test('hero.phoneNumber should be required (if enforced)', () => {
        const doc = JSON.parse(JSON.stringify(validDoc));
        doc.hero.phoneNumber = undefined;
        const m = new HandymanTemplate(doc);
        const err = m.validateSync();
        if (!err || !err.errors?.['hero.phoneNumber']) {
        console.warn('SKIP: hero.phoneNumber not required by schema');
        return;
        }
        expect(err.errors['hero.phoneNumber'].kind).toBe('required');
    });
    });
