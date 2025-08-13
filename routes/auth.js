const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: errors.array()[0].msg || 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation middleware
const validateAdminSignup = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').trim().isLength({ min: 2 }).withMessage('Full name is required'),
  body('company_name').trim().isLength({ min: 2 }).withMessage('Company name is required'),
  handleValidationErrors
];

const validateAddUser = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').trim().isLength({ min: 2 }).withMessage('Full name is required'),
  handleValidationErrors
];

// Public routes
router.post('/signup', validateAdminSignup, authController.adminSignup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

// Test endpoint to check database schema (remove in production)
router.get('/test-schema', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    
    console.log('🔍 Testing database schema...');
    
    // Test companies table
    console.log('🔍 Testing companies table...');
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .limit(1);
    
    // Test users table
    console.log('🔍 Testing users table...');
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .limit(1);
    
    const result = {
      companies: {
        data: companies,
        error: companiesError,
        columns: companies ? Object.keys(companies[0] || {}) : []
      },
      users: {
        data: users,
        error: usersError,
        columns: users ? Object.keys(users[0] || {}) : []
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Schema test result:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Schema test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to check Supabase connection
router.get('/test-connection', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    
    console.log('🔍 Testing Supabase connection...');
    
    // Test basic connection by checking if we can query
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      return res.status(500).json({ 
        error: 'Supabase connection failed', 
        details: error.message 
      });
    }
    
    console.log('✅ Supabase connection successful');
    res.json({ 
      status: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Supabase connection is working'
    });
  } catch (error) {
    console.error('❌ Connection test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to check current user's role and permissions
router.get('/test-user-permissions', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Testing user permissions:', { 
      userId: req.user?.id, 
      userRole: req.user?.role,
      userEmail: req.user?.email 
    });
    
    res.json({ 
      user: req.user,
      permissions: {
        canAddHRStaff: ['admin', 'hr_manager'].includes(req.user?.role),
        canViewHRs: ['admin', 'hr_manager'].includes(req.user?.role),
        canAccessHRDashboard: ['admin', 'hr_manager'].includes(req.user?.role)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ User permissions test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);

// Admin routes
router.post('/add-hr-manager', authenticateToken, validateAddUser, authController.addHRManager);
router.post('/add-hr-staff', authenticateToken, validateAddUser, authController.addHRStaff);

module.exports = router; 