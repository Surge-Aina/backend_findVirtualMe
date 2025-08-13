const mongoose = require('mongoose');

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/findVirtualMe');
        console.log('MongoDB connected')
    } catch (err) {
        console.error('MongoDB connection failed', err);
        throw err;
    }
};

module.exports = connectDB;