// routes/softwareEng.js
// Express router for software engineering portfolio CRUD operations

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const SoftwareEng = require('../models/softwareeng');

// Portfolio Service - integrated directly
class PortfolioService {
  constructor() {
    this.portfolioData = new Map();
    this.initializeDefaultData();
  }

  initializeDefaultData() {
    const config = this.getConfig();
    const adminEmail = config.defaultUsers.admin.email;
    const customerEmail = config.defaultUsers.customer.email;

    // Original rich portfolio data
    const originalAdminData = {
      ownerId: 'admin@test.com',
      type: 'software_engineer',
      about: {
        name: 'GAYATHRI NUTHANA GANTI',
        phone: '+1 (555) 123-4567',
        address: 'San Antonio, TX',
        linkedin: '',
        github: 'https://github.com/gayathrinuthana',
        portfolio: '',
        link1: '',
        link2: '',
        email: 'gayathri.nuthana02@gmail.com',
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
          imageUrl: '/uploads/1754434717581.pdf'
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
          skills: 1
        }
      }
    };

    const originalCustomerData = {
      ownerId: 'cust@test.com',
      type: 'software_engineer',
      about: {
        name: 'GAYATHRI NUTHANA GANTI',
        phone: '+1 (555) 123-4567',
        address: 'San Antonio, TX',
        linkedin: '',
        github: 'https://github.com/gayathrinuthana',
        portfolio: '',
        link1: '',
        link2: '',
        email: 'gayathri.nuthana02@gmail.com',
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
          imageUrl: '/uploads/1754434717581.pdf'
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
          skills: 1
        }
      }
    };

    // Set the original rich data
    this.portfolioData.set(adminEmail, originalAdminData);
    this.portfolioData.set(customerEmail, originalCustomerData);
  }

  getConfig() {
    // Get config from app settings
    return require('../index').get('config') || {
      defaultUsers: {
        admin: { email: 'admin@test.com' },
        customer: { email: 'cust@test.com' }
      },
      portfolioTemplates: {
        software_engineer: {
          type: 'software_engineer',
          about: { name: '', phone: '', address: '', linkedin: '', github: '', portfolio: '', link1: '', link2: '', email: '', bio: '', avatarUrl: '' },
          skills: [], projects: [], experience: [], education: [], certificates: [], testimonials: [], extraParts: [],
          resumePdfUrl: '', uiSettings: { baseRem: 1, sectionRem: { about: 1, skills: 1, projects: 1, experience: 1, education: 1, certificates: 1, testimonials: 1, extraParts: 1 } }
        }
      }
    };
  }

  createDefaultPortfolio(ownerId) {
    const config = this.getConfig();
    const template = config.portfolioTemplates.software_engineer;
    return {
      ownerId,
      ...template,
      about: {
        ...template.about,
        email: ownerId
      }
    };
  }

  async getPortfolio(ownerId) {
    // First try to get from MongoDB
    try {
      const portfolio = await SoftwareEng.findOne({ ownerId });
      if (portfolio) {
        return portfolio.toObject(); // Returns JSON format
      }
    } catch (error) {
      console.error('MongoDB error:', error);
    }

    // Only fallback to in-memory data if not in MongoDB
    // This prevents deleted portfolios from being recreated
    return null;
  }

  async updatePortfolio(ownerId, updateData) {
    // Save to MongoDB first
    try {
      const portfolio = await SoftwareEng.findOneAndUpdate(
        { ownerId },
        updateData,
        { new: true, upsert: true }
      );
      
      // Update in-memory data
      this.portfolioData.set(ownerId, portfolio.toObject());

      const config = this.getConfig();
      if (ownerId === config.defaultUsers.admin.email) {
        const customerEmail = config.defaultUsers.customer.email;
        const customerData = this.portfolioData.get(customerEmail);
        if (customerData) {
          this.portfolioData.set(customerEmail, { ...customerData, ...updateData });
        }
      }
      
      return portfolio.toObject(); // Returns JSON format
    } catch (error) {
      console.error('MongoDB update error:', error);
      throw error;
    }
  }

  async createPortfolio(portfolioData) {
    try {
      const portfolio = new SoftwareEng(portfolioData);
      await portfolio.save();
      return portfolio.toObject(); // Returns JSON format
    } catch (error) {
      console.error('MongoDB create error:', error);
      throw error;
    }
  }

  async deletePortfolio(ownerId) {
    // Delete from in-memory data
    this.portfolioData.delete(ownerId);
    
    try {
      // Delete from MongoDB
      const result = await SoftwareEng.findOneAndDelete({ ownerId });
      
      // Also delete any other portfolios with the same ownerId (in case of duplicates)
      await SoftwareEng.deleteMany({ ownerId });
      
      return !!result;
    } catch (error) {
      console.error('MongoDB delete error:', error);
      return false;
    }
  }

  async updateProfilePhoto(ownerId, avatarUrl) {
    const updateData = { 'about.avatarUrl': avatarUrl };
    return await this.updatePortfolio(ownerId, updateData);
  }

  getWebSocketRoom(ownerId) {
    const config = this.getConfig();
    if (ownerId === config.defaultUsers.admin.email) {
      return config.websocket.rooms.admin;
    } else if (ownerId === config.defaultUsers.customer.email) {
      return config.websocket.rooms.customer;
    }
    return `${ownerId}-updates`;
  }

  isAdmin(ownerId) {
    const config = this.getConfig();
    return ownerId === config.defaultUsers.admin.email;
  }

  async getAllPortfolios() {
    try {
      const portfolios = await SoftwareEng.find();
      return portfolios.map(p => p.toObject()); // Returns JSON format
    } catch (error) {
      console.error('MongoDB getAll error:', error);
      return Array.from(this.portfolioData.values());
    }
  }
}

// File Upload Service - integrated directly
class FileUploadService {
  constructor() {
    this.storage = this.createStorage();
    this.fileFilter = this.createFileFilter();
    this.upload = this.createUpload();
  }

  getConfig() {
    const config = require('../index').get('config') || {
      uploads: {
        directory: 'uploads',
        maxFileSize: 5 * 1024 * 1024,
        allowedMimeTypes: {
          images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          documents: ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint']
        }
      }
    };
    return config;
  }

  createStorage() {
    const config = this.getConfig();
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, config.uploads.directory);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });
  }

  createFileFilter() {
    const config = this.getConfig();
    return (req, file, cb) => {
      const allowedTypes = [
        ...config.uploads.allowedMimeTypes.images,
        ...config.uploads.allowedMimeTypes.documents
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
      }
    };
  }

  createUpload() {
    const config = this.getConfig();
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: {
        fileSize: config.uploads.maxFileSize
      }
    });
  }

  single(fieldName) {
    return this.upload.single(fieldName);
  }

  array(fieldName, maxCount) {
    return this.upload.array(fieldName, maxCount);
  }

  generateFileUrl(filename) {
    const config = this.getConfig();
    return `/${config.uploads.directory}/${filename}`;
  }

  isImage(mimetype) {
    const config = this.getConfig();
    return config.uploads.allowedMimeTypes.images.includes(mimetype);
  }

  isPdf(mimetype) {
    return mimetype === 'application/pdf';
  }

  isPowerPoint(mimetype) {
    return mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
           mimetype === 'application/vnd.ms-powerpoint';
  }

  getFileTypeInfo(mimetype) {
    return {
      isImage: this.isImage(mimetype),
      isPdf: this.isPdf(mimetype),
      isPowerPoint: this.isPowerPoint(mimetype)
    };
  }
}

// Initialize services
const portfolioService = new PortfolioService();
const fileUploadService = new FileUploadService();

/**
 * Create a new portfolio document
 * @route   POST /software-eng
 * @param   {Object} req - Express request object, expects portfolio data in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} Created portfolio document or error message
 * @notes   Only admin can create portfolios
 */
router.post('/', async (req, res) => {
  try {
    // Check if user is admin (for now, check if ownerId is admin)
    const ownerId = req.body.ownerId;
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can create portfolios.' });
    }

    const portfolio = await portfolioService.createPortfolio(req.body);
    
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
    
    res.status(201).json(portfolio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get a portfolio by ownerId
 * @route   GET /software-eng/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params
 * @param   {Object} res - Express response object
 * @returns {Object} Portfolio document or error message
 */
router.get('/:ownerId', async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolio(req.params.ownerId);
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
 * @route   PUT /software-eng/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params and update data in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} Updated portfolio document or error message
 * @notes   Only admin can update portfolios
 */
router.put('/:ownerId', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if user is admin
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can update portfolios.' });
    }
    
    const updatedPortfolio = await portfolioService.updatePortfolio(ownerId, req.body);
    
    // Emit real-time update for the updated portfolio
    const io = req.app.get('io');
    if (io) {
      // Emit to specific user's room
      const roomName = portfolioService.getWebSocketRoom(ownerId);
      io.to(roomName).emit('portfolio-changed', {
        ownerId: ownerId,
        portfolio: updatedPortfolio,
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
    
    res.json(updatedPortfolio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a portfolio by ownerId
 * @route   DELETE /software-eng/:ownerId
 * @param   {Object} req - Express request object, expects ownerId in req.params
 * @param   {Object} res - Express response object
 * @returns {Object} Success message or error message
 * @notes   Only admin can delete portfolios
 */
router.delete('/:ownerId', async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if user is admin
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can delete portfolios.' });
    }
    
    const success = await portfolioService.deletePortfolio(ownerId);
    if (!success) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Emit real-time update for portfolio deletion
    const io = req.app.get('io');
    if (io) {
      io.emit('portfolio-deleted', {
        ownerId: ownerId,
        message: 'Portfolio deleted',
        timestamp: new Date().toISOString()
      });
      console.log('📡 Portfolio deletion event emitted for:', ownerId);
    }
    
    res.json({ message: 'Portfolio deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload profile photo
 * @route   POST /software-eng/:ownerId/photo
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Avatar URL or error message
 * @notes   Only admin can upload files
 */
router.post('/:ownerId/photo', fileUploadService.single('avatar'), async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if user is admin
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can upload files.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file uploaded' });
    }
    
    const avatarUrl = fileUploadService.generateFileUrl(req.file.filename);
    await portfolioService.updateProfilePhoto(ownerId, avatarUrl);
    
    // Emit real-time update for avatar upload
    const io = req.app.get('io');
    if (io) {
      const roomName = portfolioService.getWebSocketRoom(ownerId);
      io.to(roomName).emit('avatar-uploaded', {
        ownerId: ownerId,
        avatarUrl: avatarUrl,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Avatar upload event emitted for:', ownerId);
    }
    
    res.json({ avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload project image
 * @route   POST /software-eng/:ownerId/project-image
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Image URL or error message
 * @notes   Only admin can upload files
 */
router.post('/:ownerId/project-image', fileUploadService.single('projectImage'), async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if user is admin
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can upload files.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imageUrl = fileUploadService.generateFileUrl(req.file.filename);
    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload certificate image/document
 * @route   POST /software-eng/:ownerId/certificate-image
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} File information or error message
 * @notes   Only admin can upload files
 */
router.post('/:ownerId/certificate-image', fileUploadService.single('certificateImage'), async (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    
    // Check if user is admin
    if (!portfolioService.isAdmin(ownerId)) {
      return res.status(403).json({ error: 'Access denied. Only admin can upload files.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const imageUrl = fileUploadService.generateFileUrl(req.file.filename);
    const fileTypeInfo = fileUploadService.getFileTypeInfo(req.file.mimetype);
    
    console.log('Certificate uploaded successfully:', imageUrl);
    
    res.json({ 
      imageUrl,
      ...fileTypeInfo
    });
  } catch (err) {
    console.error('Certificate upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get PDF preview
 * @route   GET /software-eng/pdf-preview/:filename
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {File} PDF file or error message
 */
router.get('/pdf-preview/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '..', config.uploads.directory, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
  } catch (err) {
    console.error('PDF preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 