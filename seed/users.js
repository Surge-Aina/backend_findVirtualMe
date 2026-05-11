const bcrypt = require('bcryptjs');
const User = require('../src/shared/models/User');

/**
 * Seed users for development
 * Creates admin and customer accounts if they don't exist
 */
const seedUsers = async () => {
  try {
    console.log('🔐 Checking for seed users...');
    
    // Check if users already exist
    const existingUsers = await User.find();
    if (existingUsers.length > 0) {
      console.log('✅ Users already exist, skipping seed');
      return;
    }

    console.log('🌱 Creating seed users...');

    // Create admin user
    const adminPassword = await bcrypt.hash('Admin@123', 12);
    const admin = new User({
      username: 'admin',
      email: 'admin@test.com',
      password: adminPassword,
      role: 'admin'
    });

    // Create customer user
    const customerPassword = await bcrypt.hash('Cust@123', 12);
    const customer = new User({
      username: 'customer',
      email: 'cust@test.com',
      password: customerPassword,
      role: 'customer'
    });

    await admin.save();
    await customer.save();

    console.log('✅ Seed users created successfully!');
    console.log('📋 Default Credentials:');
    console.log('👑 Admin: admin@test.com / Admin@123');
    console.log('👤 Customer: cust@test.com / Cust@123');
    console.log('');
  } catch (error) {
    console.error('❌ Error seeding users:', error);
  }
};

module.exports = seedUsers; 