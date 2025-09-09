const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    portfolioId: { type: String, required: true, index: true }, // Had this in my code--not sure if it's needed here?
    name: { type: String },
    username: {type: String, unique: true},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    portfolioIds: [{ type: String }]
});

module.exports = mongoose.model('UserModel', userSchema);