// routes/portfolio.js
// Express router for portfolio CRUD operations

console.log('📁 Loading portfolio routes...');

const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const upload = require('../utils/multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');

// In-memory storage for portfolio data (temporary solution)
let portfolioData = {
  'admin@test.com': {
    ownerId: 'admin@test.com',
    type: 'software_engineer',
    profile: {
      name: 'GAYATHRI NUTHANA GANTI',
      email: 'gayathri.nuthana02@gmail.com',
      location: 'San Antonio, TX',
      github: 'https://github.com/gayathrinuthana',
      linkedin: '',
      bio: 'Aspiring Full Stack Developer with practical experience in developing and maintaining web and mobile applications using the MERN stack (MongoDB, Express.js, React, Node.js). Passionate about building scalable, user-friendly solutions and continuously expanding technical knowledge.',
      avatarUrl: ''
    },
    skills: [
      { name: 'AWS', level: 'Advanced' },
      { name: 'Terraform', level: 'Advanced', rating: 4 },
      { name: 'Python', level: 'Advanced', rating: 3 },
      { name: 'SQL', level: 'Beginner', rating: 3 }
    ],
    projects: [
      {
        title: 'Cloud Engineering',
        description: 'Developed and optimized a serverless data cleaning pipeline using AWS Lambda, improving data processing efficiency by 3x. Built real-time data visualizations with Amazon QuickSight, identifying bottlenecks in hospital operational data. Documented the pipeline architecture and processes for future scalability and efficiency.',
        repoUrl: 'https://github.com/gayathrinuthana',
        demoUrl: '',
        techStack: ['AWS', 'Terraform'],
        imageUrl: null
      },
      {
        title: 'SQL-Based Healthcare Wait Time Analysis',
        description: 'Analyzed 5,000+ healthcare records using advanced SQL techniques to identify inefficiencies in hospital wait times. Built interactive dashboards using Excel and SQL query outputs to help stakeholders visualize operational inefficiencies.',
        repoUrl: 'https://github.com/gayathrinuthana/sql-healthcare-project',
        demoUrl: '',
        techStack: ['SQL', 'Excel'],
        imageUrl: null
      },
      {
        title: 'AWS Serverless Data Cleaning Pipeline',
        description: 'Developed and optimized a serverless data cleaning pipeline using AWS Lambda, improving data processing efficiency by 3x. Built real-time data visualizations with Amazon QuickSight, identifying bottlenecks in hospital operational data. Documented the pipeline architecture and processes for future scalability and efficiency.',
        repoUrl: 'https://github.com/gayathrinuthana/aws-serverless-csv-cleaner',
        demoUrl: '',
        techStack: ['AWS Lambda', 'AWS Quicksight', 'Python'],
        imageUrl: null
      }
    ],
    experience: [
      {
        company: 'PrimEra Medical Technologies',
        role: 'Executive – Clinical Information Management',
        duration: 'Aug 2021 – Jul 2023',
        details: 'Led the management of EMR systems (EPIC, Meditech) to manage large-scale data and streamline cross-functional workflows. Contributed to backend systems integration, enhancing efficiency and compliance with healthcare data regulations.'
      },
      {
        company: 'SurgeAina',
        role: 'Full stack Developer Intern',
        duration: 'June 2025 - Sep 2025',
        details: '● Full-stack development (MERN, REST APIs) ● Scalable project architecture ● Sprint-based collaboration ● Agile workflows and startup environments ● Optional exposure to AI/ML integration, design systems, and product thinking'
      }
    ],
    education: [
      {
        degree: 'Master of Science in Information Technology & Management',
        institution: 'Campbellsville University, KY',
        year: 'Expected October 2025'
      }
    ],
    certifications: [
      {
        title: 'AWS',
        year: '2023',
        imageUrl: ''
      },
      {
        title: 'AWS',
        year: '2023',
        imageUrl: ''
      },
      {
        title: 'kpmg',
        year: '2023',
        imageUrl: ''
      }
    ],
    resumePdfUrl: '',
    uiSettings: {
      baseRem: 1,
      sectionRem: {
        about: 1,
        projects: 1,
        experience: 1,
        education: 1,
        certifications: 1,
        skills: 1,
        contact: 1
      }
    }
  },
  'cust@test.com': {
    ownerId: 'cust@test.com',
    type: 'software_engineer',
    profile: {
      name: 'GAYATHRI NUTHANA GANTI',
      email: 'gayathri.nuthana02@gmail.com',
      location: 'San Antonio, TX',
      github: 'https://github.com/gayathrinuthana',
      linkedin: '',
      bio: 'Aspiring Full Stack Developer with practical experience in developing and maintaining web and mobile applications using the MERN stack (MongoDB, Express.js, React, Node.js). Passionate about building scalable, user-friendly solutions and continuously expanding technical knowledge.',
      avatarUrl: ''
    },
    skills: [
      { name: 'AWS', level: 'Advanced' },
      { name: 'Terraform', level: 'Advanced', rating: 4 },
      { name: 'Python', level: 'Advanced', rating: 3 },
      { name: 'SQL', level: 'Beginner', rating: 3 }
    ],
    projects: [
      {
        title: 'Cloud Engineering',
        description: 'Developed and optimized a serverless data cleaning pipeline using AWS Lambda, improving data processing efficiency by 3x. Built real-time data visualizations with Amazon QuickSight, identifying bottlenecks in hospital operational data. Documented the pipeline architecture and processes for future scalability and efficiency.',
        repoUrl: 'https://github.com/gayathrinuthana',
        demoUrl: '',
        techStack: ['AWS', 'Terraform'],
        imageUrl: null
      },
      {
        title: 'SQL-Based Healthcare Wait Time Analysis',
        description: 'Analyzed 5,000+ healthcare records using advanced SQL techniques to identify inefficiencies in hospital wait times. Built interactive dashboards using Excel and SQL query outputs to help stakeholders visualize operational inefficiencies.',
        repoUrl: 'https://github.com/gayathrinuthana/sql-healthcare-project',
        demoUrl: '',
        techStack: ['SQL', 'Excel'],
        imageUrl: null
      },
      {
        title: 'AWS Serverless Data Cleaning Pipeline',
        description: 'Developed and optimized a serverless data cleaning pipeline using AWS Lambda, improving data processing efficiency by 3x. Built real-time data visualizations with Amazon QuickSight, identifying bottlenecks in hospital operational data. Documented the pipeline architecture and processes for future scalability and efficiency.',
        repoUrl: 'https://github.com/gayathrinuthana/aws-serverless-csv-cleaner',
        demoUrl: '',
        techStack: ['AWS Lambda', 'AWS Quicksight', 'Python'],
        imageUrl: null
      }
    ],
    experience: [
      {
        company: 'PrimEra Medical Technologies',
        role: 'Executive – Clinical Information Management',
        duration: 'Aug 2021 – Jul 2023',
        details: 'Led the management of EMR systems (EPIC, Meditech) to manage large-scale data and streamline cross-functional workflows. Contributed to backend systems integration, enhancing efficiency and compliance with healthcare data regulations.'
      },
      {
        company: 'SurgeAina',
        role: 'Full stack Developer Intern',
        duration: 'June 2025 - Sep 2025',
        details: '● Full-stack development (MERN, REST APIs) ● Scalable project architecture ● Sprint-based collaboration ● Agile workflows and startup environments ● Optional exposure to AI/ML integration, design systems, and product thinking'
      }
    ],
    education: [
      {
        degree: 'Master of Science in Information Technology & Management',
        institution: 'Campbellsville University, KY',
        year: 'Expected October 2025'
      }
    ],
    certifications: [
      {
        title: 'AWS',
        year: '2023',
        imageUrl: ''
      },
      {
        title: 'AWS',
        year: '2023',
        imageUrl: '/uploads/1754434512724.pdf'
      },
      {
        title: 'kpmg',
        year: '2023',
        imageUrl: '/uploads/1754434736496.pdf'
      }
    ],
    resumePdfUrl: '',
    uiSettings: {
      baseRem: 1,
      sectionRem: {
        about: 1,
        projects: 1,
        experience: 1,
        education: 1,
        certifications: 1,
        skills: 1,
        contact: 1
      }
    }
  }
};

// Using configured multer from utils/multer.js

/**
 * Create a new portfolio document
 * @route   POST /api/portfolio
 * @param   {Object} req - Express request object, expects portfolio data in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} Created portfolio document or error message
 * @notes   In production, this should be protected by authentication
 */
router.post('/', async (req, res) => {
  try {
    const portfolio = new Portfolio(req.body); // Create new portfolio from request body
    await portfolio.save(); // Save to MongoDB
    
    // Emit real-time update for portfolio creation
    const io = req.app.get('io');
    if (io) {
      io.emit('portfolio-created', {
        ownerId: portfolio.ownerId,
        portfolio: portfolio,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Portfolio creation event emitted for:', portfolio.ownerId);
    }
    
    res.status(201).json(portfolio); // Return created portfolio
  } catch (err) {
    res.status(400).json({ error: err.message }); // Return error if validation fails
  }
});

/**
 * Get a portfolio by ownerId
 * @route   GET /api/portfolio/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params
 * @param   {Object} res - Express response object
 * @returns {Object} Portfolio document or error message
 * @notes   In production, this should be protected by authentication
 */
router.get('/:ownerId', async (req, res) => {
  try {
    const portfolio = portfolioData[req.params.ownerId];
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a portfolio by ownerId
 * @route   PUT /api/portfolio/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params and update data in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} Updated portfolio document or error message
 * @notes   In production, this should be protected by authentication
 */
router.put('/:ownerId', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if portfolio exists
    if (!portfolioData[ownerId]) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Update the portfolio data
    portfolioData[ownerId] = { ...portfolioData[ownerId], ...req.body };
    
    // If this is the admin portfolio, also sync to customer portfolio
    if (ownerId === 'admin@test.com') {
      try {
        const io = req.app.get('io'); // Get Socket.IO instance
        console.log('🔄 Syncing admin portfolio to customer portfolio...');
        
        // Sync to customer portfolio
        portfolioData['cust@test.com'] = { ...portfolioData['cust@test.com'], ...req.body };
        console.log('✅ Customer portfolio synced successfully');
        
        // Emit real-time update to customer dashboard
        if (io) {
          io.to('customer-updates').emit('portfolio-updated', {
            message: 'Portfolio updated by admin',
            timestamp: new Date().toISOString()
          });
          console.log('📡 Real-time update sent to customer dashboard');
        }
      } catch (syncErr) {
        console.error('Failed to sync customer portfolio:', syncErr);
        // Don't fail the admin update if sync fails
      }
    }
    
    // Emit real-time update for the updated portfolio
    const io = req.app.get('io');
    if (io) {
      // Emit to specific user's room
      io.to(`${ownerId}-updates`).emit('portfolio-changed', {
        ownerId: ownerId,
        portfolio: portfolioData[ownerId],
        updatedBy: 'user',
        timestamp: new Date().toISOString()
      });
      
      // Also emit general update
      io.emit('portfolio-updated', {
        ownerId: ownerId,
        message: 'Portfolio updated',
        timestamp: new Date().toISOString()
      });
      
      console.log('📡 Real-time update emitted for portfolio:', ownerId);
    }
    
    res.json(portfolioData[ownerId]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a portfolio by ownerId
 * @route   DELETE /api/portfolio/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params
 * @param   {Object} res - Express response object
 * @returns {Object} Success message or error message
 * @notes   In production, this should be protected by authentication
 */
router.delete('/:ownerId', async (req, res) => {
  try {
    const result = await Portfolio.findOneAndDelete({ ownerId: req.params.ownerId }); // Delete by ownerId
    if (!result) return res.status(404).json({ error: 'Portfolio not found' });
    
    // Emit real-time update for portfolio deletion
    const io = req.app.get('io');
    if (io) {
      io.emit('portfolio-deleted', {
        ownerId: req.params.ownerId,
        message: 'Portfolio deleted',
        timestamp: new Date().toISOString()
      });
      console.log('📡 Portfolio deletion event emitted for:', req.params.ownerId);
    }
    
    res.json({ message: 'Portfolio deleted' }); // Return success message
  } catch (err) {
    res.status(500).json({ error: err.message }); // Return error if delete fails
  }
});

// POST /portfolio/:ownerId/photo - upload profile photo
router.post('/:ownerId/photo', upload.single('avatar'), async (req, res) => {
  try {
    const avatarUrl = `/uploads/${req.file.filename}`;
    const portfolio = await Portfolio.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { 'profile.avatarUrl': avatarUrl },
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });
    
    // Emit real-time update for avatar upload
    const io = req.app.get('io');
    if (io) {
      io.to(`${req.params.ownerId}-updates`).emit('avatar-uploaded', {
        ownerId: req.params.ownerId,
        avatarUrl: avatarUrl,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Avatar upload event emitted for:', req.params.ownerId);
    }
    
    res.json({ avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /portfolio/:ownerId/project-image - upload project image
router.post('/:ownerId/project-image', upload.single('projectImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /portfolio/:ownerId/certificate-image - upload certificate image
router.post('/:ownerId/certificate-image', upload.single('certificateImage'), async (req, res) => {
  try {
    console.log('Certificate upload request received:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    console.log('Certificate image uploaded successfully:', imageUrl);
    
    // If it's a PDF or PowerPoint, create a preview image
    let previewUrl = null;
    let isPdf = req.file.mimetype === 'application/pdf';
    let isPowerPoint = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
                      req.file.mimetype === 'application/vnd.ms-powerpoint';
    
    if (isPdf || isPowerPoint) {
      try {
        // For now, we'll return the same URL but mark it appropriately
        // In a production environment, you'd convert PDF/PowerPoint to image here
        previewUrl = imageUrl; // This would be the preview image URL
      } catch (previewError) {
        console.error('Error creating preview:', previewError);
      }
    }
    
    res.json({ 
      imageUrl,
      previewUrl,
      isPdf: isPdf,
      isPowerPoint: isPowerPoint
    });
  } catch (err) {
    console.error('Certificate upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /portfolio/pdf-preview/:filename - get PDF preview
router.get('/pdf-preview/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // For now, return the PDF file directly
    // In production, you'd convert PDF to image and return that
    res.sendFile(filePath);
  } catch (err) {
    console.error('PDF preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /portfolio/:ownerId/resume - upload and parse resume PDF
router.post('/:ownerId/resume', upload.single('resume'), async (req, res) => {
  try {
    console.log('📄 Resume upload request received for:', req.params.ownerId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }
    
    // Check if file is PDF
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }
    
    const resumeUrl = `/uploads/${req.file.filename}`;
    console.log('📄 Resume uploaded successfully:', resumeUrl);
    
    // Parse PDF and extract text
    const pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // For now, we'll use a simple text extraction
    // In production, you'd use a more sophisticated PDF parser
    const pdfText = await extractTextFromPDF(pdfBuffer);
    console.log('📄 Extracted text from PDF:', pdfText.substring(0, 200) + '...');
    
    // Convert text to portfolio JSON structure
    const portfolioData = await convertResumeToPortfolio(pdfText, req.params.ownerId);
    console.log('📄 Converted resume to portfolio data');
    
    // Save to MongoDB
    let portfolio = await Portfolio.findOne({ ownerId: req.params.ownerId });
    
    if (portfolio) {
      // Update existing portfolio
      portfolio.resumePdfUrl = resumeUrl;
      portfolio.profile = { ...portfolio.profile, ...portfolioData.profile };
      portfolio.skills = portfolioData.skills || portfolio.skills;
      portfolio.projects = portfolioData.projects || portfolio.projects;
      portfolio.experience = portfolioData.experience || portfolio.experience;
      portfolio.education = portfolioData.education || portfolio.education;
      portfolio.certifications = portfolioData.certifications || portfolio.certifications;
    } else {
      // Create new portfolio
      portfolio = new Portfolio({
        ownerId: req.params.ownerId,
        type: 'software_engineer',
        resumePdfUrl: resumeUrl,
        ...portfolioData
      });
    }
    
    await portfolio.save();
    console.log('✅ Portfolio saved to MongoDB');
    
    // Update in-memory data for real-time updates
    if (portfolioData[req.params.ownerId]) {
      portfolioData[req.params.ownerId] = {
        ...portfolioData[req.params.ownerId],
        resumePdfUrl: resumeUrl,
        ...portfolioData
      };
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`${req.params.ownerId}-updates`).emit('resume-uploaded', {
        ownerId: req.params.ownerId,
        resumeUrl: resumeUrl,
        portfolio: portfolio,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Resume upload event emitted for:', req.params.ownerId);
    }
    
    res.json({ 
      success: true,
      resumeUrl: resumeUrl,
      portfolio: portfolio,
      message: 'Resume uploaded and portfolio updated successfully'
    });
    
  } catch (err) {
    console.error('❌ Resume upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to extract text from PDF
async function extractTextFromPDF(pdfBuffer) {
  try {
    console.log('📄 Extracting text from PDF...');
    const data = await pdfParse(pdfBuffer);
    console.log('📄 PDF text extracted successfully');
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Helper function to convert resume text to portfolio structure
async function convertResumeToPortfolio(resumeText, ownerId) {
  try {
    // Parse the resume text and extract structured data
    const lines = resumeText.split('\n').filter(line => line.trim());
    
    let profile = {
      name: '',
      email: '',
      location: '',
      github: '',
      linkedin: '',
      bio: ''
    };
    
    let skills = [];
    let experience = [];
    let education = [];
    let projects = [];
    
    // Extract name (usually first line)
    if (lines[0]) {
      profile.name = lines[0].trim();
    }
    
    // Extract email
    const emailMatch = resumeText.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      profile.email = emailMatch[0];
    }
    
    // Extract skills (look for SKILLS section)
    const skillsIndex = lines.findIndex(line => line.toUpperCase().includes('SKILLS'));
    if (skillsIndex !== -1) {
      for (let i = skillsIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.toUpperCase().includes('EXPERIENCE') && !line.toUpperCase().includes('EDUCATION')) {
          const skillNames = line.split(',').map(skill => skill.trim());
          skills.push(...skillNames.map(name => ({ name, level: 'Intermediate' })));
        } else {
          break;
        }
      }
    }
    
    // Extract experience
    const experienceIndex = lines.findIndex(line => line.toUpperCase().includes('EXPERIENCE'));
    if (experienceIndex !== -1) {
      for (let i = experienceIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && line.includes('-')) {
          const parts = line.split('-');
          if (parts.length >= 2) {
            experience.push({
              company: parts[0].trim(),
              role: 'Software Engineer',
              duration: parts[1].trim(),
              details: 'Extracted from resume'
            });
          }
        }
      }
    }
    
    // Extract education
    const educationIndex = lines.findIndex(line => line.toUpperCase().includes('EDUCATION'));
    if (educationIndex !== -1) {
      for (let i = educationIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && line.includes('-')) {
          const parts = line.split('-');
          if (parts.length >= 2) {
            education.push({
              degree: parts[0].trim(),
              institution: 'University',
              year: parts[1].trim()
            });
          }
        }
      }
    }
    
    // Create bio from summary
    const summaryIndex = lines.findIndex(line => line.toUpperCase().includes('SUMMARY'));
    if (summaryIndex !== -1) {
      let bio = '';
      for (let i = summaryIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.toUpperCase().includes('SKILLS')) {
          bio += line + ' ';
        } else {
          break;
        }
      }
      profile.bio = bio.trim();
    }
    
    return {
      profile,
      skills: skills.slice(0, 10), // Limit to 10 skills
      experience: experience.slice(0, 5), // Limit to 5 experiences
      education: education.slice(0, 3), // Limit to 3 education entries
      projects: projects.slice(0, 3), // Limit to 3 projects
      certifications: []
    };
    
  } catch (error) {
    console.error('Error converting resume to portfolio:', error);
    throw new Error('Failed to convert resume to portfolio structure');
  }
}

// Test route to verify router is loaded
router.get('/test', (req, res) => {
  res.json({ message: 'Portfolio router is working!', timestamp: new Date().toISOString() });
});

/**
 * Export the router for use in server.js
 * @returns {Router} Express router with portfolio CRUD routes
 */
module.exports = router; 