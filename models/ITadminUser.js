const mongoose = require('mongoose');

const ITadminUserSchema = new mongoose.Schema({
    name: { type: String },
    username: {type: String, unique: true},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

module.exports = mongoose.model('ITadminUser', ITadminUserSchema);
