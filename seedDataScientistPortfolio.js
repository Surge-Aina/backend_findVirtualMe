const mongoose = require('mongoose');
const DataScientistPortfolio = require('./models/dataScientistPortfolioModel');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/findVirtualMe';

const seedDataScientistPortfolio = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if portfolio already exists
    const existingPortfolio = await DataScientistPortfolio.findOne({ portfolioId: 'datascience' });
    
    if (existingPortfolio) {
      console.log('Data Scientist portfolio already exists. Updating...');
      await DataScientistPortfolio.deleteOne({ portfolioId: 'datascience' });
    }

    // Create the datascience portfolio
    const dataScientistPortfolio = new DataScientistPortfolio({
      name: 'Gargi Ghadigaonkar',
      title: 'Data Scientist & Machine Learning Engineer',
      email: 'ghadigaonkargargi@gmail.com',
      location: 'San Francisco, CA',
      summary: 'Passionate Computer Science graduate with experience in data science, machine learning, and full-stack development. Skilled in Python, R, SQL, JavaScript, and various ML frameworks.',
      socialLinks: {
        github: 'https://github.com/ghadigaonkar',
        linkedin: 'https://linkedin.com/in/ghadigaonkar'
      },
      experience: [
        {
          title: 'Data Scientist',
          company: 'Tech Company',
          location: 'San Francisco, CA',
          description: [
            'Developed machine learning models for predictive analytics',
            'Implemented data pipelines using Python and SQL',
            'Collaborated with cross-functional teams to deliver insights'
          ],
          startDate: new Date('2023-01-01'),
          endDate: null,
          current: true
        },
        {
          title: 'Machine Learning Intern',
          company: 'AI Startup',
          location: 'Remote',
          description: [
            'Built and deployed ML models for customer segmentation',
            'Optimized model performance using hyperparameter tuning',
            'Created data visualization dashboards'
          ],
          startDate: new Date('2022-06-01'),
          endDate: new Date('2022-12-31'),
          current: false
        }
      ],
      education: [
        {
          school: 'California State University, Chico',
          degrees: ['Masters in Computer Science'],
          description: 'Expected Dec 2024',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-12-01'),
          current: true
        },
        {
          school: 'Thadomal Shahani Engineering College',
          degrees: ['Bachelor of Engineering in Information Technology'],
          description: 'May 2019',
          startDate: new Date('2015-08-01'),
          endDate: new Date('2019-05-01'),
          current: false
        }
      ],
      projects: [
        {
          title: 'Customer Churn Prediction',
          description: 'Built a machine learning model to predict customer churn using Python, scikit-learn, and XGBoost. Achieved 85% accuracy and helped reduce churn by 20%.',
          tags: ['Python', 'Machine Learning', 'Scikit-learn', 'XGBoost', 'Pandas'],
          github: 'https://github.com/ghadigaonkar/churn-prediction',
          live: null,
          image: null
        },
        {
          title: 'Data Visualization Dashboard',
          description: 'Created an interactive dashboard using React and D3.js to visualize sales data and provide insights to stakeholders.',
          tags: ['React', 'JavaScript', 'D3.js', 'Data Visualization', 'CSS'],
          github: 'https://github.com/ghadigaonkar/dashboard',
          live: 'https://dashboard-demo.com',
          image: null
        },
        {
          title: 'Natural Language Processing API',
          description: 'Developed a REST API for sentiment analysis using Flask and NLTK. Processes text data and returns sentiment scores.',
          tags: ['Python', 'Flask', 'NLTK', 'NLP', 'REST API'],
          github: 'https://github.com/ghadigaonkar/nlp-api',
          live: null,
          image: null
        }
      ],
      skills: [
        {
          category: 'Programming Languages',
          skills: ['Python', 'R', 'JavaScript', 'SQL', 'Java']
        },
        {
          category: 'Machine Learning',
          skills: ['Scikit-learn', 'TensorFlow', 'PyTorch', 'XGBoost', 'Pandas', 'NumPy']
        },
        {
          category: 'Data Visualization',
          skills: ['Matplotlib', 'Seaborn', 'Plotly', 'D3.js', 'Tableau']
        },
        {
          category: 'Web Development',
          skills: ['React', 'Node.js', 'Express', 'HTML', 'CSS', 'Bootstrap']
        },
        {
          category: 'Databases',
          skills: ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis']
        },
        {
          category: 'Tools & Platforms',
          skills: ['Git', 'Docker', 'AWS', 'Google Cloud', 'Jupyter', 'VS Code']
        }
      ],
      about: {
        bio: 'I am a passionate data scientist with a strong foundation in computer science and a love for turning data into actionable insights. I enjoy working on challenging problems and learning new technologies.',
        interests: ['Machine Learning', 'Data Science', 'Web Development', 'Open Source', 'Reading'],
        certifications: ['AWS Certified Machine Learning - Specialty', 'Google Data Analytics Professional Certificate']
      },
      settings: {
        theme: 'terminal',
        showContact: true,
        showSkills: true
      },
      portfolioId: 'datascience'
    });

    await dataScientistPortfolio.save();
    console.log('✅ Data Scientist portfolio seeded successfully!');
    console.log('Portfolio ID:', dataScientistPortfolio.portfolioId);
    console.log('Experience items:', dataScientistPortfolio.experience.length);
    console.log('Education items:', dataScientistPortfolio.education.length);
    console.log('Project items:', dataScientistPortfolio.projects.length);
    console.log('Skill categories:', dataScientistPortfolio.skills.length);

  } catch (error) {
    console.error('❌ Error seeding datascience portfolio:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the seeding function
seedDataScientistPortfolio();
