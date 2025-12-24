const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../../models/User')
const UserData = require('../../models/healthcare/userData');
const verifyToken = require('../../middleware/auth')

// ⚙️ CONFIGURATION: Allow multiple healthcare portfolios per user
const ALLOW_MULTIPLE_HEALTHCARE_PORTFOLIOS = true; // ✅ ENABLED

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Healthcare API',
    timestamp: new Date().toISOString()
  })
})

// Get public practice data by practiceId
router.get('/practice/:practiceId', async (req, res) => {
  try {
    const { practiceId } = req.params
    
    const userData = await UserData.findOne({ 
      practiceId, 
      isActive: true 
    })
    
    if (!userData) {
      return res.status(404).json({ error: 'Practice not found' })
    }
    
    res.json(userData)
  } catch (error) {
    console.error('Error fetching practice data:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get practice by subdomain
router.get('/subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params
    
    const userData = await UserData.findOne({ 
      subdomain: subdomain.toLowerCase(),
      isActive: true 
    })
    
    if (!userData) {
      return res.status(404).json({ error: 'Practice not found' })
    }
    
    res.json(userData)
  } catch (error) {
    console.error('Error fetching practice by subdomain:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Register new Practice
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, practiceName } = req.body

    // Get userId from authenticated request if available
    let authenticatedUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        authenticatedUserId = decoded.id;
        console.log('✅ Authenticated user creating healthcare portfolio:', authenticatedUserId);
      } catch (err) {
        console.log('⚠️ Token verification failed during registration:', err.message);
      }
    }

    // Validation
    if (!email || !password || !firstName || !lastName || !practiceName) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      })
    }

    // Generate unique practice ID
    const practiceId = `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('🏥 Creating new practice:', practiceId);

    let user;
    let isExistingUser = false;
    
    // If authenticated user is creating portfolio, use their account
    if (authenticatedUserId) {
      user = await User.findById(authenticatedUserId);
      if (!user) {
        console.error('❌ Authenticated user not found:', authenticatedUserId);
        return res.status(404).json({ error: 'Authenticated user not found' });
      }
      console.log('✅ Using existing authenticated user:', user.email);
      console.log('📊 User currently has', user.portfolios?.filter(p => p.portfolioType === 'Healthcare').length || 0, 'healthcare portfolio(s)');
      isExistingUser = true;
    } else {
      // Check if user exists by email
      const existingUser = await User.findOne({ email: email.toLowerCase() })
      if (existingUser) {
        console.error('❌ Email already registered:', email);
        return res.status(400).json({ 
          error: 'Email already registered. Please login first.' 
        })
      }

      // Create new user
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        username: email.toLowerCase(), 
        role: 'admin',
        portfolios: []
      })

      await user.save()
      console.log('✅ New user created:', user.email);
    }

    // Create practice data
    const practiceData = new UserData({
      practiceId,
      userId: user._id.toString(),
      isActive: true,
      isPublic: false,
      portfolioType: 'Healthcare',
      practice: {
        name: practiceName,
        tagline: 'Your Health, Our Priority',
        description: 'Providing exceptional healthcare services.'
      },
      contact: {
        phone: '',
        whatsapp: '',
        email: email,
        address: {
          street: '',
          city: '',
          state: '',
          zip: ''
        }
      },
      hours: {
        weekdays: 'Mon-Fri: 9:00 AM - 5:00 PM',
        saturday: 'Sat: Closed',
        sunday: 'Sun: Closed'
      },
      stats: {
        yearsExperience: '0',
        patientsServed: '0',
        successRate: '0',
        doctorsCount: '0'
      },
      services: [],
      team: [],
      blogPosts: [],
      gallery: {
        facilityImages: [],
        beforeAfterCases: []
      },
      seo: {
        siteTitle: `${practiceName} - Healthcare Services`,
        metaDescription: 'Quality healthcare services',
        keywords: 'healthcare, medical, clinic'
      }
    })

    await practiceData.save()
    console.log('✅ Practice data created:', practiceId);

    // ✅ Add portfolio to user's portfolios array
    if (!user.portfolios) {
      user.portfolios = [];
    }
    
    // Check if this specific portfolio already exists (shouldn't happen, but just in case)
    const portfolioExists = user.portfolios.some(
      p => p.portfolioId === practiceId
    );
    
    if (!portfolioExists) {
      user.portfolios.push({
        portfolioId: practiceId,
        portfolioType: 'Healthcare',
        isPublic: false
      });
      
      await user.save();
      const healthcareCount = user.portfolios.filter(p => p.portfolioType === 'Healthcare').length;
      console.log('✅ Portfolio added to user\'s portfolios array');
      console.log('📊 User now has', healthcareCount, 'healthcare portfolio(s)');
    } else {
      console.log('⚠️ Portfolio already exists in user array');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        practiceId: practiceId,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    )

    res.status(201).json({
      success: true,
      message: 'Practice registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        practiceId: practiceId,
        role: user.role,
        portfolios: user.portfolios
      },
      practiceId,
      portfolioType: 'Healthcare'
    })

    console.log('✅ Healthcare registration completed successfully');

  } catch (error) {
    console.error('❌ Registration error:', error)
    res.status(500).json({ 
      error: 'Registration failed',
      details: error.message 
    })
  }
})

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    user.lastLogin = new Date()
    await user.save()

    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        practiceId: user.practiceId,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    )

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        practiceId: user.practiceId,
        role: user.role
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get current user info
router.get('/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ==========================================
// ADMIN ROUTES (Auth Required)
// ==========================================

// Get practice data for admin
router.get('/admin/data', verifyToken, async (req, res) => {
  try {
    const userData = await UserData.findOne({ 
      practiceId: req.user.practiceId 
    })
    
    if (!userData) {
      return res.status(404).json({ error: 'Practice data not found' })
    }
    
    res.json(userData)
  } catch (error) {
    console.error('Error fetching admin data:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Save practice data
router.post('/admin/data', verifyToken, async (req, res) => {
  try {
    const practiceId = req.user.practiceId
    const updateData = req.body

    const updatedDocument = await UserData.findOneAndUpdate(
      { practiceId },
      { 
        $set: updateData, 
        lastModified: new Date()
      }, 
      { 
        new: true,
        runValidators: true
      }
    )
    
    if (!updatedDocument) {
      return res.status(404).json({ error: 'Practice not found or not owned by user' })
    }

    res.json({ 
      success: true, 
      message: 'Data saved successfully',
      timestamp: updatedDocument.lastModified
    })

  } catch (error) {
    console.error('Error saving data:', error)
    res.status(500).json({ 
      success: false,
      error: 'Failed to save data',
      details: error.message 
    })
  }
})

// Update practice subdomain
router.post('/admin/subdomain', verifyToken, async (req, res) => {
  try {
    const { subdomain } = req.body
    const practiceId = req.user.practiceId

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ 
        error: 'Invalid subdomain. Use only lowercase letters, numbers, and hyphens.' 
      })
    }

    const existing = await UserData.findOne({ 
      subdomain: subdomain.toLowerCase(),
      practiceId: { $ne: practiceId }
    })

    if (existing) {
      return res.status(400).json({ error: 'Subdomain already taken' })
    }

    await UserData.findOneAndUpdate(
      { practiceId },
      { subdomain: subdomain.toLowerCase() }
    )

    res.json({ success: true, message: 'Subdomain updated successfully' })

  } catch (error) {
    console.error('Error updating subdomain:', error)
    res.status(500).json({ error: 'Failed to update subdomain' })
  }
})

// ==========================================
// GET USER'S HEALTHCARE PORTFOLIOS
// ==========================================

// Get all healthcare portfolios for authenticated user
router.get('/user/portfolios', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const practices = await UserData.find({ 
      userId: userId,
      isActive: true 
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: practices.length,
      practices: practices
    });
    
  } catch (error) {
    console.error('Error fetching user practices:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// INITIALIZATION
// ==========================================

const initializeData = async () => {
  try {
    const count = await UserData.countDocuments()
    
    if (count === 0) {
      console.log('🏥 Creating demo practice...')
      
      const demoUser = new User({
        email: 'demo@healthcare.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Demo',
        lastName: 'User',
        username: 'demo',
        role: 'admin',
        portfolios: []
      })
      
      await demoUser.save()
      
      const practiceId = 'practice_demo';
      
      const demoData = new UserData({
        practiceId,
        userId: demoUser._id.toString(),
        subdomain: 'demo',
        isActive: true,
        isPublic: true,
        portfolioType: 'Healthcare',
        practice: {
          name: 'Elite Medical Center',
          tagline: 'Your Health, Our Priority',
          description: 'Providing exceptional healthcare services with state-of-the-art technology.'
        },
        contact: {
          phone: '+1 (555) 123-4567',
          whatsapp: '+1 (555) 123-4567',
          email: 'info@elitemedical.com',
          address: {
            street: '123 Healthcare Blvd, Suite 200',
            city: 'Austin',
            state: 'TX',
            zip: '78701'
          }
        },
        hours: {
          weekdays: 'Mon-Fri: 8:00 AM - 6:00 PM',
          saturday: 'Sat: 9:00 AM - 2:00 PM',
          sunday: 'Sun: Closed'
        },
        stats: {
          yearsExperience: '15',
          patientsServed: '5,000',
          successRate: '98',
          doctorsCount: '8'
        },
        services: [],
        team: [],
        blogPosts: [],
        gallery: {
          facilityImages: [],
          beforeAfterCases: []
        },
        seo: {
          siteTitle: 'Elite Medical Center - Healthcare Services',
          metaDescription: 'Leading healthcare facility',
          keywords: 'healthcare, medical, clinic'
        }
      })
      
      await demoData.save()
      
      demoUser.portfolios.push({
        portfolioId: practiceId,
        portfolioType: 'Healthcare',
        isPublic: true
      });
      await demoUser.save();
      
      console.log('✅ Demo practice created')
      console.log('📧 Demo login: demo@healthcare.com / demo123')
      console.log('🔗 Demo URL: /portfolios/healthcare/practice_demo')
    } else {
      console.log('✅ Healthcare practices already exist')
    }
  } catch (error) {
    console.error('❌ Healthcare init error:', error)
  }
}

initializeData()

module.exports = router