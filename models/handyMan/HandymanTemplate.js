// models/handyMan/HandymanTemplate.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
  icon: { type: String, default: '🔧' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  bullets: { type: [String], default: [] },
  name: { type: String }
}, { _id: false });

ServiceSchema.pre('validate', function (next) {
  if (!this.title && this.name) this.title = this.name;
  next();
});

const TestimonialSchema = new Schema({
  quote: { type: String, required: true },
  name: { type: String, required: true }
}, { _id: false });

const ProcessStepSchema = new Schema({
  number: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true }
}, { _id: false });

const HandymanTemplateSchema = new Schema({
  userId: { type: String, unique: true },

  // Projects / gallery copy
  portfolioTitle: { type: String, default: 'Quality Craftsmanship You Can See' },
  portfolioSubtitle: { type: String, default: '' },       // <-- section sub-text
  portfolioAllLabel: { type: String, default: 'All' },

  servicesSectionTitle: {
    type: String,
    default: 'A One-Call Solution for Your To-Do List'
  },
  servicesSectionIntro: {
    type: String,
    default: "We handle a wide range of home maintenance and repair solutions so you don't have to juggle multiple contractors."
  },

  processSectionTitle: { type: String, default: 'Our Simple Process' },
  testimonialsSectionTitle: { type: String, default: 'What Our Clients Say' },

  contactSectionTitle: { type: String, default: 'Contact Us' },
  contactSectionSubtitle: { type: String, default: 'Ready to get started? Send us a message!' },

  hero: {
    title: { type: String, default: 'Trusted Handyman for Home Repairs & Maintenance' },
    subtitle: { type: String, default: 'Licensed, Insured, and Ready to Help. Call us today!' },
    phoneNumber: { type: String, default: '(123) 456-7890' },
    imageUrl: { type: String, default: '' },
    badge1Text: { type: String, default: 'Licensed & Insured' },
    badge2Text: { type: String, default: '5-Star Rated' },
    badge3Text: { type: String, default: '24/7 Emergency Service' },
    ctaText: { type: String, default: 'Request a Free Estimate' }
  },

  services: {
    type: [ServiceSchema],
    default: () => [
      { icon: '💧', title: 'Plumbing Repairs', description: 'Quick and efficient plumbing repairs and installs.', bullets: ['Faucet repair', 'Toilet install', 'Pipe fixes', 'Heater service'] },
      { icon: '🔨', title: 'Electrical Work', description: 'Safe and reliable electrical services for your projects.', bullets: ['Light installs', 'Outlet repair', 'Ceiling fans', 'Switches'] }
    ]
  },

  processSteps: {
    type: [ProcessStepSchema],
    default: () => [
      { number: 1, title: 'Request a Quote', description: 'Fill out our form or give us a call.' },
      { number: 2, title: 'We Confirm Details', description: "We'll contact you to confirm the job scope." }
    ]
  },

  testimonials: {
    type: [TestimonialSchema],
    default: () => [{ name: 'Jane D.', quote: 'Incredibly reliable and professional.' }]
  }
}, { timestamps: true });

module.exports = mongoose.model('HandymanTemplate', HandymanTemplateSchema);
