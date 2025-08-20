require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const createUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/findVirtualMe');
    console.log('✅ Connected to MongoDB');

    // Check if users already exist
    const existingUsers = await User.find();
    if (existingUsers.length > 0) {
      console.log('✅ Users already exist, skipping creation');
      console.log('📋 Existing users:');
      existingUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role})`);
      });
      return;
    }

    console.log('🌱 Creating test users...');

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

    console.log('✅ Test users created successfully!');
    console.log('📋 Default Credentials:');
    console.log('👑 Admin: admin@test.com / Admin@123');
    console.log('👤 Customer: cust@test.com / Cust@123');
    console.log('');
    console.log('🔐 JWT Secrets:');
    console.log('📱 Main Portfolio: 1234567890');
    console.log('💻 Software Engineer: eadf50f302ece478535332bd3f0cee4a6fa76e247f884833e38912d96a421096');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

createUsers();

