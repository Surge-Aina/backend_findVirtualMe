const mongoose = require('mongoose');
const Portfolio = require('./models/portfolioModel');
require('dotenv').config();

const addDataScientistPortfolio = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/findVirtualMe', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');

    // Check if datascience portfolio already exists
    const existingPortfolio = await Portfolio.findOne({ email: 'ghadigaonkargargi@gmail.com' });
    
    if (existingPortfolio) {
      console.log('DataScientist portfolio already exists');
      process.exit(0);
    }

    // Create datascience portfolio data in the integrated backend format
    const dataScientistPortfolio = new Portfolio({
      name: 'Gargi Ghadigaonkar',
      title: 'Data Scientist & Machine Learning Engineer',
      summary: 'Passionate Computer Science graduate with experience in machine learning, web development, and software engineering. Skilled in Python, JavaScript, and various ML frameworks.',
      email: 'ghadigaonkargargi@gmail.com',
      phone: '+1(530) 715 5928',
      location: 'Chico, CA',
      skills: [
        'Python', 'C', 'C++', 'Go', 'Swift', 'JavaScript', 'TypeScript', 'SQL', 'R',
        'ETL Pipelines', 'Data Warehousing', 'Spark(PySpark)', 'Data Modeling', 'JSON/XML',
        'Google Cloud Platform', 'Amazon Web Services', 'Docker', 'GitHub', 'GitLab',
        'Word2Vec', 'BERT', 'Meta Learning', 'OpenCV', 'SVM', 'HOG',
        'PyTorch', 'TensorFlow', 'Scikit-learn', 'CUDA', 'PostgreSQL', 'Oracle', 'SQLite', 'OpenCV'
      ],
      experiences: [
        {
          company: 'CSU Chico',
          title: 'Research Assistant',
          location: 'Chico, CA',
          startDate: new Date('2025-02-01'),
          endDate: null, // Present
          description: 'Conducting research on distinguishing analogies from word groupings in Word2Vec using genetic programming. Technologies: Python, GloVe/Word2Vec, Genetic Programming, DEAP, NLP'
        },
        {
          company: 'TechComb',
          title: 'Machine Learning Intern',
          location: 'Austin, TX',
          startDate: new Date('2024-08-01'),
          endDate: new Date('2024-12-31'),
          description: 'Designed and developed machine vision applications to enhance automated quality control systems. Achieved a 20% increase in detection accuracy by optimizing pre-processing pipelines. Technologies: Python, OpenCV, Image preprocessing, Model Optimization'
        }
      ],
      education: [
        {
          school: 'California State University, Chico',
          gpa: 3.8,
          degrees: ['Masters in Computer Science'],
          fieldOfStudy: 'Computer Science',
          awards: [],
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-12-31'),
          description: 'Expected Dec 2024'
        },
        {
          school: 'Thadomal Shahani Engineering College',
          gpa: 3.7,
          degrees: ['Bachelor of Engineering in Information Technology'],
          fieldOfStudy: 'Information Technology',
          awards: [],
          startDate: new Date('2015-08-01'),
          endDate: new Date('2019-05-31'),
          description: 'May 2019'
        }
      ],
      projects: [
        {
          name: 'Analysis of Transfer learning on Language models',
          description: 'Researching the impact of domain adaptation and soft prompt tuning on pre-trained models (MAML, BERT). Tools & Concepts: Python, Transfer Learning, Domain Adaptation, Meta Learning, Prompt Tuning'
        },
        {
          name: 'Recommendation system for E-commerce',
          description: 'Developed a graph-based recommendation system on Amazon dataset using preferential attachment principles. Employed vector embeddings and graph structures to capture user preferences. Technologies: Python, Graph Embeddings, Vector embeddings'
        }
      ],
      socialLinks: {
        github: 'https://github.com/yourusername',
        linkedin: 'https://linkedin.com/in/yourusername',
        website: ''
      }
    });

    await dataScientistPortfolio.save();
    console.log('DataScientist portfolio created successfully');
    console.log('Portfolio ID:', dataScientistPortfolio._id);

    process.exit(0);
  } catch (err) {
    console.error('Error creating datascience portfolio:', err);
    process.exit(1);
  }
};

addDataScientistPortfolio();
