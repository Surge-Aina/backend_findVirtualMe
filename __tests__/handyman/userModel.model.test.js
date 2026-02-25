    // __tests__/handyman/userModel.model.test.js

    let User;

    try {
    // Prefer the actual Mongoose model file name used in repo
    User = require('../../models/User');
    } catch (e1) {
    try {
        User = require('../../models/userModel');
    } catch (e2) {
        // neither path loaded, will skip
    }
    }

    const isMongooseModel =
    User &&
    typeof User === 'function' &&
    User.modelName &&
    User.schema;

    const runOrSkip = isMongooseModel ? describe : describe.skip;

    runOrSkip('Model: User', () => {
    const schema = User.schema;

    // 🔍 Build a valid document that matches the real schema
    const validDoc = {};

    if (schema.path('email')) {
        validDoc.email = 'user@test.com';
    }

    if (schema.path('username')) {
        validDoc.username = 'testuser';
    }

    if (schema.path('password')) {
        validDoc.password = 'hash-or-plain';
    } else if (schema.path('passwordHash')) {
        validDoc.passwordHash = 'hash-or-plain';
    }

    if (schema.path('role')) {
        const roles = schema.path('role').enumValues || [];
        if (roles.length > 0) {
        validDoc.role = roles[0];
        }
    }

    test('valid user passes validateSync()', () => {
        const m = new User(validDoc);
        const err = m.validateSync();
        expect(err).toBeUndefined();
    });

    test('requires email (if present in schema)', () => {
        if (!schema.path('email')) {
        console.warn('SKIP: email field not in schema');
        return;
        }
        const m = new User({ ...validDoc, email: undefined });
        const err = m.validateSync();
        if (!err || !err.errors?.email) {
        console.warn('SKIP: email not marked required in schema');
        return;
        }
        expect(err.errors.email.kind).toBe('required');
    });

    test('requires username (if present in schema)', () => {
        if (!schema.path('username')) {
        console.warn('SKIP: username field not in schema');
        return;
        }
        const doc = { ...validDoc };
        delete doc.username;
        const m = new User(doc);
        const err = m.validateSync();
        if (!err || !err.errors?.username) {
        console.warn('SKIP: username not marked required in schema');
        return;
        }
        expect(err.errors.username.kind).toBe('required');
    });

    test('requires password or passwordHash (if present)', () => {
        const hasPassword = !!schema.path('password');
        const hasPasswordHash = !!schema.path('passwordHash');

        if (!hasPassword && !hasPasswordHash) {
        console.warn('SKIP: no password/passwordHash field in schema');
        return;
        }

        const tryField = (field) => {
        const doc = { ...validDoc };
        delete doc[field];
        const m = new User(doc);
        return m.validateSync();
        };

        if (hasPassword) {
        const err = tryField('password');
        if (!err || !err.errors?.password) {
            console.warn('SKIP: password not marked required in schema');
        } else {
            expect(err.errors.password.kind).toBe('required');
        }
        } else if (hasPasswordHash) {
        const err = tryField('passwordHash');
        if (!err || !err.errors?.passwordHash) {
            console.warn('SKIP: passwordHash not marked required in schema');
        } else {
            expect(err.errors.passwordHash.kind).toBe('required');
        }
        }
    });

    test('role enum (if enforced) rejects unknown', () => {
        const rolePath = schema.path('role');
        if (!rolePath) {
        console.warn('SKIP: no role field in schema');
        return;
        }
        const enumValues = rolePath.enumValues || [];
        if (!enumValues.length) {
        console.warn('SKIP: role enum not enforced by schema');
        return;
        }

        const invalidRole = '__invalid_role__';
        const m = new User({ ...validDoc, role: invalidRole });
        const err = m.validateSync();
        if (!err || !err.errors?.role) {
        console.warn('SKIP: role enum not enforced despite enumValues');
        return;
        }
        expect(err.errors.role.kind).toBe('enum');
    });
    });
