const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();



const serviceSchema = new mongoose.Schema({
  serviceName: String,
  category: String,
  estimatedPrice: Number,
});
const Service = mongoose.model('Service', serviceSchema);

const handymanPortfolioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  beforeImageUrl: { type: String, required: true },
  afterImageUrl: { type: String, required: true },
}, { timestamps: true, collection: 'handymanportfolios' });
const HandymanPortfolio = mongoose.model('HandymanPortfolio', handymanPortfolioSchema);


const testimonialSchema = new mongoose.Schema({
  customerName: String,
  location: String,
  quote: String,
});
const Testimonial = mongoose.model('Testimonial', testimonialSchema);



const seedDatabase = async () => {
  try {

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connected successfully.');


    const jsonPath = path.join(__dirname, 'seedData.json');
    const seedData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));


    if (seedData.services) {
      await Service.deleteMany({});
      await Service.insertMany(seedData.services);
      console.log('Services collection seeded.');
    }


    if (seedData.portfolio) {
      await HandymanPortfolio.deleteMany({});
      await HandymanPortfolio.insertMany(seedData.portfolio);
      console.log('Portfolio collection seeded.');
    }

    if (seedData.testimonials) {
      await Testimonial.deleteMany({});
      await Testimonial.insertMany(seedData.testimonials);
      console.log('Testimonials collection seeded.');
    }

    console.log('Database seeding complete!');

  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedDatabase();