// models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: String, default: '' } 
});

module.exports = mongoose.model('Service', serviceSchema, 'services');
