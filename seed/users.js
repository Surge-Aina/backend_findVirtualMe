const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../src/shared/models/User');

const REQUIRED_ENV = [
  'ADMIN_EMAIL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'CUSTOMER_EMAIL',
  'CUSTOMER_USERNAME',
  'CUSTOMER_PASSWORD',
];

function requireSeedEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) for user seed: ${missing.join(', ')}`
    );
  }
}

/**
 * Seed admin and customer accounts when the database has no users.
 * Credentials are read from the environment and are never logged.
 */
const seedUsers = async () => {
  requireSeedEnv();

  console.log('Checking for seed users...');

  const existingCount = await User.countDocuments();
  if (existingCount > 0) {
    console.log('Users already exist, skipping seed');
    return;
  }

  console.log('Creating seed users...');

  const admin = new User({
    userKey: crypto.randomUUID(),
    practiceId: crypto.randomUUID(),
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
    role: 'admin',
  });

  const customer = new User({
    userKey: crypto.randomUUID(),
    practiceId: crypto.randomUUID(),
    username: process.env.CUSTOMER_USERNAME,
    email: process.env.CUSTOMER_EMAIL,
    password: await bcrypt.hash(process.env.CUSTOMER_PASSWORD, 12),
    role: 'customer',
  });

  await admin.save();
  await customer.save();

  console.log('Seed users created');
};

module.exports = seedUsers;
