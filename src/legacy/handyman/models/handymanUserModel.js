const mongoose = require('mongoose');

const handymanUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const HandymanUser = mongoose.model('HandymanUser', handymanUserSchema);

module.exports = HandymanUser;
