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
    title: { type: String, required: true },
    description: { type: String, required: true }
}, { _id: false });


const HandymanTemplateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  portfolioTitle: { type: String, default: 'My Handyman Services' },
  hero: {
    title: { type: String, default: 'Trusted Handyman for Home Repairs & Maintenance' },
    subtitle: { type: String, default: 'Licensed, Insured, and Ready to Help. Call us today!' },
    phoneNumber: { type: String, default: '(123) 456-7890' }
  },
  services: { type: [ServiceSchema], default: () => ([{name: 'Plumbing Repairs'}, {name: 'Electrical Work'}]) },
  processSteps: { type: [ProcessStepSchema], default: () => ([
      { number: 1, title: 'Request a Quote', description: 'Fill out our form or give us a call.' },
      { number: 2, title: 'We Confirm Details', description: 'We\'ll contact you to confirm the job scope.' },
  ])},
  testimonials: { type: [TestimonialSchema], default: () => ([{name: 'Jane D.', quote: 'Incredibly reliable and professional.'}]) },
}, { timestamps: true });

module.exports = mongoose.model('HandymanTemplate', HandymanTemplateSchema);