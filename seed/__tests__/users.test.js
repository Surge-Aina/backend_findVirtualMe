const bcrypt = require('bcryptjs');
const User = require('../../src/shared/models/User');
const seedUsers = require('../users');

const ENV_KEYS = [
  'ADMIN_EMAIL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'CUSTOMER_EMAIL',
  'CUSTOMER_USERNAME',
  'CUSTOMER_PASSWORD',
];

describe('seedUsers', () => {
  const original = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it('fails clearly when required credentials are missing', async () => {
    await expect(seedUsers()).rejects.toThrow(
      'Missing required environment variable(s) for user seed: ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD, CUSTOMER_EMAIL, CUSTOMER_USERNAME, CUSTOMER_PASSWORD'
    );
  });

  it('creates users from the environment and stores password hashes', async () => {
    process.env.ADMIN_EMAIL = 'seed-admin@example.com';
    process.env.ADMIN_USERNAME = 'seed-admin';
    process.env.ADMIN_PASSWORD = 'synthetic-admin-pass';
    process.env.CUSTOMER_EMAIL = 'seed-customer@example.com';
    process.env.CUSTOMER_USERNAME = 'seed-customer';
    process.env.CUSTOMER_PASSWORD = 'synthetic-customer-pass';

    await seedUsers();

    const admin = await User.findOne({ email: 'seed-admin@example.com' });
    const customer = await User.findOne({ email: 'seed-customer@example.com' });

    expect(admin.role).toBe('admin');
    expect(admin.username).toBe('seed-admin');
    expect(admin.password).not.toBe('synthetic-admin-pass');
    expect(await bcrypt.compare('synthetic-admin-pass', admin.password)).toBe(true);
    expect(customer.role).toBe('customer');
    expect(await bcrypt.compare('synthetic-customer-pass', customer.password)).toBe(true);
  });
});
