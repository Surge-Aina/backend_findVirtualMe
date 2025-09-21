// routes/portfolio.js
// Express router for portfolio CRUD operations

console.log('📁 Loading portfolio routes...');

const express = require('express');
const router = express.Router();
const Portfolio = require('../../models/softwareEngineer/Portfolio');
const { uploadResume, uploadImage, uploadToCloudinary } = require('../../utils/cloudinaryUpload');
const pdfParse = require('pdf-parse');

// Custom middleware to handle raw file uploads with size limit
const handleRawUpload = (req, res, next) => {
  let data = [];
  let totalSize = 0;
  const maxSize = 25 * 1024 * 1024; // 25MB limit for images
  
  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      return res.status(413).json({ error: 'File too large. Maximum size is 25MB.' });
    }
    data.push(chunk);
  });
  
  req.on('end', () => {
    req.body = Buffer.concat(data);
    next();
  });
  
  req.on('error', (err) => {
    console.error('❌ Request error:', err);
    res.status(500).json({ error: 'Request processing error' });
  });
};

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

// Note: Old photo upload route removed - now using Cloudinary profile-image route

// Note: Old project-image route removed - now using Cloudinary project-image route

// Note: Old certificate-image route removed - now using Cloudinary certificate-image route

// Note: Old PDF preview route removed - Cloudinary handles file serving

// Custom middleware for PDF uploads with larger size limit
const handlePdfUpload = (req, res, next) => {
  let data = [];
  let totalSize = 0;
  const maxSize = 50 * 1024 * 1024; // 50MB limit
  
  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    data.push(chunk);
  });
  
  req.on('end', () => {
    req.body = Buffer.concat(data);
    next();
  });
  
  req.on('error', (err) => {
    console.error('❌ PDF upload request error:', err);
    res.status(500).json({ error: 'Request processing error' });
  });
};

// POST /portfolio/:ownerId/resume - upload and parse resume PDF
router.post('/:ownerId/resume', handlePdfUpload, async (req, res) => {
  try {
    console.log('📄 Resume upload request received for:', req.params.ownerId);
    
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }
    
    // Check if file is PDF (basic check)
    if (!req.headers['content-type']?.includes('application/pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }
    
    console.log('📄 PDF file received, uploading to Cloudinary...');
    
    // Upload PDF to Cloudinary
    const uploadResult = await uploadResume(req.body, req.params.ownerId);
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Failed to upload to Cloudinary: ' + uploadResult.error });
    }
    
    const resumeUrl = uploadResult.url;
    console.log('📄 Resume uploaded to Cloudinary successfully:', resumeUrl);
    
    // Parse PDF and extract text
    const pdfBuffer = req.body;
    
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

// POST /portfolio/:ownerId/project-image - upload project image to Cloudinary
router.post('/:ownerId/project-image', handleRawUpload, async (req, res) => {
  try {
    console.log('🖼️ Project image upload request received for:', req.params.ownerId);
    
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // req.body is already a Buffer from our custom middleware
    const fileBuffer = req.body;
    
    // Upload image to Cloudinary
    const uploadResult = await uploadImage(fileBuffer, req.params.ownerId, 'projects');
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Failed to upload to Cloudinary: ' + uploadResult.error });
    }
    
    console.log('🖼️ Project image uploaded to Cloudinary successfully:', uploadResult.url);
    
    res.json({ 
      success: true,
      imageUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      message: 'Project image uploaded successfully'
    });
    
  } catch (err) {
    console.error('❌ Project image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Custom middleware for certificate uploads with larger size limit (PDFs can be bigger)
const handleCertificateUpload = (req, res, next) => {
  let data = [];
  let totalSize = 0;
  const maxSize = 50 * 1024 * 1024; // 50MB limit for certificates (PDFs can be large)
  
  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    data.push(chunk);
  });
  
  req.on('end', () => {
    req.body = Buffer.concat(data);
    next();
  });
  
  req.on('error', (err) => {
    console.error('❌ Certificate upload request error:', err);
    res.status(500).json({ error: 'Request processing error' });
  });
};

// POST /portfolio/:ownerId/certificate-image - upload certificate file (PDF, PNG, JPEG) to Cloudinary
router.post('/:ownerId/certificate-image', handleCertificateUpload, async (req, res) => {
  try {
    console.log('🏆 Certificate upload request received for:', req.params.ownerId);
    console.log('🏆 Request body type:', typeof req.body);
    console.log('🏆 Request body length:', req.body?.length);
    console.log('🏆 Request body is Buffer:', Buffer.isBuffer(req.body));
    console.log('🏆 Request body first bytes:', req.body?.slice?.(0, 10));
    
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No certificate file uploaded' });
    }
    
    // req.body is already a Buffer from our custom middleware
    const fileBuffer = req.body;
    console.log('🏆 FileBuffer length:', fileBuffer.length);
    console.log('🏆 FileBuffer first bytes:', fileBuffer.slice(0, 10));
    
    // Determine file type and upload accordingly
    let uploadResult;
    
    // Check if it's a PDF file
    if (fileBuffer.length > 4 && 
        fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && 
        fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
      // PDF file detected - upload as raw document
      console.log('🏆 PDF certificate detected, uploading as document...');
      uploadResult = await uploadToCloudinary(fileBuffer, `certificates/${req.params.ownerId}`, {
        resource_type: 'raw',
        format: 'pdf'
      });
    } else {
      // Image file detected - upload as image
      console.log('🏆 Image certificate detected, uploading as image...');
      uploadResult = await uploadImage(fileBuffer, req.params.ownerId, 'certificates');
    }
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Failed to upload to Cloudinary: ' + uploadResult.error });
    }
    
    console.log('🏆 Certificate uploaded to Cloudinary successfully:', uploadResult.url);
    
    res.json({ 
      success: true,
      imageUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      message: 'Certificate uploaded successfully'
    });
    
  } catch (err) {
    console.error('❌ Certificate upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /portfolio/:ownerId/profile-image - upload profile image to Cloudinary
router.post('/:ownerId/profile-image', handleRawUpload, async (req, res) => {
  try {
    console.log('👤 Profile image upload request received for:', req.params.ownerId);
    
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // req.body is already a Buffer from our custom middleware
    const fileBuffer = req.body;
    
    // Upload image to Cloudinary
    const uploadResult = await uploadImage(fileBuffer, req.params.ownerId, 'profile');
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Failed to upload to Cloudinary: ' + uploadResult.error });
    }
    
    console.log('👤 Profile image uploaded to Cloudinary successfully:', uploadResult.url);
    
    // Update portfolio with new profile image
    const portfolio = await Portfolio.findOne({ ownerId: req.params.ownerId });
    if (portfolio) {
      portfolio.profile.avatarUrl = uploadResult.url;
      await portfolio.save();
      console.log('✅ Portfolio updated with new profile image');
    }
    
    res.json({ 
      success: true,
      imageUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      message: 'Profile image uploaded successfully'
    });
    
  } catch (err) {
    console.error('❌ Profile image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Export the router for use in server.js
 * @returns {Router} Express router with portfolio CRUD routes
 */
module.exports = router; 