const mongoose = require('mongoose');

const ITadminUserSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verificationType: { type: String },
    lastLogin: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ITadminUser', ITadminUserSchema);
