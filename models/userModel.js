const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String },
    username: {type: String, unique: true},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    portfolioIds: [{ type: String }]
});

module.exports = mongoose.model('UserModel', userSchema);