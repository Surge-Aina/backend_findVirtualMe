const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
  icon: { type: String, default: '🔧' },
  name: { type: String, required: true }
}, { _id: false });

const TestimonialSchema = new Schema({
  quote: { type: String, required: true },
  name: { type: String, required: true }
}, { _id: false });

const ProcessStepSchema = new Schema({
  number: { type: Number, required: true },
  title:  { type: String, required: true },
  description: { type: String, required: true }
}, { _id: false });

const HandymanTemplateSchema = new Schema({
  userId: { type: String, unique: true },

  // Section copy you can edit
  portfolioTitle:          { type: String, default: 'My Handyman Services' },

  servicesSectionTitle:    { type: String, default: 'A One-Call Solution for Your To-Do List' },
  servicesSectionIntro:    { type: String, default: "We handle a wide range of home maintenance and repair solutions so you don't have to juggle multiple contractors." },

  portfolioSectionTitle:   { type: String, default: 'Quality Craftsmanship You Can See' },

  processSectionTitle:     { type: String, default: 'Our Simple Process' }, // shown if you want a static title
  testimonialsSectionTitle:{ type: String, default: 'What Our Clients Say' },

  contactSectionTitle:     { type: String, default: 'Contact Us' },
  contactSectionSubtitle:  { type: String, default: 'Ready to get started? Send us a message!' },

  portfolioSectionTitle: { type: String, default: 'Quality Craftsmanship You Can See' },
  portfolioAllLabel:     { type: String, default: 'All' },
  // Existing sections
  hero: {
    title:       { type: String, default: 'Trusted Handyman for Home Repairs & Maintenance' },
    subtitle:    { type: String, default: 'Licensed, Insured, and Ready to Help. Call us today!' },
    phoneNumber: { type: String, default: '(123) 456-7890' }
  },

  services: { 
    type: [ServiceSchema], 
    default: () => ([{ name: 'Plumbing Repairs' }, { name: 'Electrical Work' }]) 
  },

  processSteps: { 
    type: [ProcessStepSchema], 
    default: () => ([
      { number: 1, title: 'Request a Quote', description: 'Fill out our form or give us a call.' },
      { number: 2, title: 'We Confirm Details', description: "We'll contact you to confirm the job scope." },
    ])
  },

  testimonials: { 
    type: [TestimonialSchema], 
    default: () => ([{ name: 'Jane D.', quote: 'Incredibly reliable and professional.' }]) 
  },

}, { timestamps: true });

module.exports = mongoose.model('HandymanTemplate', HandymanTemplateSchema);
