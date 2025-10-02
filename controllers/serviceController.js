// controllers/serviceController.js
const Service = require('../models/serviceModel.js');
const mongoose = require('mongoose');

// Get all services
const getServices = async (req, res) => {
  try {
    const services = await Service.find(); // No filtering on non-existent fields
    res.status(200).json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services', error: err.message });
  }
};

// Get single service by ID
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'Invalid service ID' });
    }

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ msg: 'Service not found' });
    res.json(service);
  } catch (err) {
    console.error('getServiceById Error:', err);
    res.status(500).json({ msg: 'Error retrieving service' });
  }
};

// Create a new service
const createService = async (req, res) => {
  try {
    const { title, description, price = '' } = req.body;

    if (!title || !description) {
      return res.status(400).json({ msg: 'Title and description are required' });
    }

    const newService = new Service({ title, description, price });
    await newService.save();

    res.status(201).json(newService);
  } catch (err) {
    console.error('Create Service Error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Update a service
const updateService = async (req, res) => {
  try {
    const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ msg: 'Service not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update service', error: err.message });
  }
};

// Delete a service
const deleteService = async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: 'Service not found' });
    res.status(200).json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete service', error: err.message });
  }
};

module.exports = { getServices, getServiceById, createService, updateService, deleteService};