const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
  authenticateToken, 
  requireHR, 
  requireHRManager,
  requireTeamLead,
  validateCompanyAccess,
  validateEmployeeAccess 
} = require('../middleware/auth');
const userController = require('../controllers/userController');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

// Test route without authentication for debugging
router.get('/test-public', (req, res) => {
  res.json({
    message: 'Public test endpoint is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers
  });
});

// Test route to check if routes are working at all
router.get('/test-route', (req, res) => {
  res.json({
    message: 'Route is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    url: req.url,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
});

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
const validateAddEmployee = [
  body('email').isEmail().normalizeEmail(),
  body('full_name').trim().isLength({ min: 2 }),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('salary').isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  body('joining_date').isDate().withMessage('Valid joining date is required'),
  body('phone_number').optional().trim(),
  body('address').optional().trim(),
  body('emergency_contact').optional().trim(),
  body('pan_number').optional().trim(),
  body('bank_account').optional().trim(),
  body('leave_balance').optional().isInt({ min: 0, max: 365 }).withMessage('Leave balance must be between 0 and 365 days'),
  handleValidationErrors
];

const validateUpdateEmployee = [
  body('email').isEmail().normalizeEmail(),
  body('full_name').trim().isLength({ min: 2 }),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('salary').isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  body('joining_date').isDate().withMessage('Valid joining date is required'),
  body('phone_number').optional().trim(),
  body('address').optional().trim(),
  body('emergency_contact').optional().trim(),
  body('pan_number').optional().trim(),
  body('bank_account').optional().trim(),
  body('leave_balance').optional().isInt({ min: 0, max: 365 }).withMessage('Leave balance must be between 0 and 365 days'),
  handleValidationErrors
];

const validateUpdateCompanyProfile = [
  body('name').trim().isLength({ min: 2 }),
  body('email').optional().custom((value) => {
    if (value && value.trim() !== '') {
      // Only validate if email is provided and not empty
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Invalid email format');
      }
    }
    return true;
  }).normalizeEmail(),
  body('website').optional().custom((value) => {
    if (value && value.trim() !== '') {
      // Only validate if website is provided and not empty
      try {
        new URL(value);
      } catch {
        throw new Error('Invalid website URL');
      }
    }
    return true;
  }),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  handleValidationErrors
];

// Apply authentication to all routes
router.use(authenticateToken);
router.use(validateCompanyAccess);



// Test endpoint for development (returns mock data)
router.get('/test', (req, res) => {
  res.json({
    message: 'API is working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Simple health check for users route
router.get('/health', (req, res) => {
  res.json({
    message: 'Users route is working!',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /employees',
      'GET /employees/:id',
      'PUT /employees/:id',
      'POST /employees',
      'DELETE /employees/:id'
    ]
  });
});

// Mock data endpoint for development
router.get('/mock/employees', (req, res) => {
  const mockEmployees = [
    {
      id: 'emp-1',
      full_name: 'John Doe',
      email: 'john.doe@company.com',
      department: 'Engineering',
      designation: 'Senior Developer',
      salary: 75000,
      joining_date: '2023-01-15',
      phone_number: '+1234567890',
      leave_balance: 15,
      created_at: '2023-01-15T00:00:00Z',
      user: {
        id: 'user-1',
        full_name: 'John Doe',
        email: 'john.doe@company.com',
        role: 'employee',
        company_id: 'mock-company-id',
        is_active: true
      }
    },
    {
      id: 'emp-2',
      full_name: 'Jane Smith',
      email: 'jane.smith@company.com',
      department: 'Marketing',
      designation: 'Marketing Manager',
      salary: 65000,
      joining_date: '2023-02-20',
      phone_number: '+1234567891',
      leave_balance: 20,
      created_at: '2023-02-20T00:00:00Z',
      user: {
        id: 'user-2',
        full_name: 'Jane Smith',
        email: 'jane.smith@company.com',
        role: 'employee',
        company_id: 'mock-company-id',
        is_active: true
      }
    }
  ];

  res.json({ 
    employees: mockEmployees,
    total: mockEmployees.length,
    user_role: req.user?.role || 'unknown',
    company_id: req.user?.company_id || 'mock-company-id'
  });
});

// Dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    const { user } = req;
    
    // Get basic dashboard data based on user role
    const dashboardData = {
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      stats: {
        totalEmployees: 0,
        pendingLeaveRequests: 0,
        leaveRequests: 0,
        salarySlipsGenerated: 0
      },
      recentEmployees: [],
      companyInfo: null
    };

    // Get employees count
    try {
      const { data: employees, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id, full_name, email, department, designation, salary, joining_date, created_at')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!empError && employees) {
        dashboardData.stats.totalEmployees = employees.length;
        dashboardData.recentEmployees = employees;
      }
    } catch (error) {
      // Continue with 0 if employees fetch fails
    }

    // Get pending leave requests count
    try {
      const { data: pendingLeaveRequests, error: leaveError } = await supabaseAdmin
        .from('leave_requests')
        .select('id')
        .eq('status', 'pending')
        .eq('company_id', user.company_id);

      if (!leaveError && pendingLeaveRequests) {
        dashboardData.stats.pendingLeaveRequests = pendingLeaveRequests.length;
      }
    } catch (error) {
      // Continue with 0 if leave requests fetch fails
    }

    // Get total leave requests count
    try {
      const { data: leaveRequests, error: leaveError } = await supabaseAdmin
        .from('leave_requests')
        .select('id')
        .eq('company_id', user.company_id);

      if (!leaveError && leaveRequests) {
        dashboardData.stats.leaveRequests = leaveRequests.length;
      }
    } catch (error) {
      // Continue with 0 if leave requests fetch fails
    }

    // Get salary slips generated this month
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: salarySlips, error: salaryError } = await supabaseAdmin
        .from('salary_slips')
        .select('id')
        .eq('company_id', user.company_id)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (!salaryError && salarySlips) {
        dashboardData.stats.salarySlipsGenerated = salarySlips.length;
      }
    } catch (error) {
      // Continue with 0 if salary slips fetch fails
    }

    // Get company info
    try {
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();

      if (!companyError && company) {
        dashboardData.companyInfo = company;
      }
    } catch (error) {
      // Continue with null if company info fetch fails
    }

    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/mock/company', (req, res) => {
  const mockCompany = {
    id: 'mock-company-id',
    name: 'Test Company Ltd.',
    address: '123 Business Street, Tech City, TC 12345',
    phone: '+1 (555) 123-4567',
    email: 'contact@testcompany.com',
    website: 'https://testcompany.com',
    logo_url: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  res.json({ company: mockCompany });
});

// Company profile routes
router.get('/company/profile', userController.getCompanyProfile);
router.put('/company/profile', requireHR, validateUpdateCompanyProfile, userController.updateCompanyProfile);

// Employee viewing routes (accessible by all authenticated users)
router.get('/employees/view', userController.getEmployeesForViewing);

// Create employee record for existing user (if missing)
router.post('/create-employee-record', userController.createEmployeeRecordForUser);

// Test endpoint to check employee record status
router.get('/check-employee-record', userController.createEmployeeRecordForUser);

// Employee management routes with hierarchical access
router.post('/employees', requireHR, validateAddEmployee, userController.addEmployee);
router.get('/employees', userController.getEmployees);
router.get('/employees/:id', validateEmployeeAccess, userController.getEmployee);
router.put('/employees/:id', requireHR, validateEmployeeAccess, validateUpdateEmployee, userController.updateEmployee);
router.delete('/employees/:id', requireHR, validateEmployeeAccess, userController.deleteEmployee);
router.post('/employees/:id/reset-password', requireHR, validateEmployeeAccess, userController.resetEmployeePassword);

// Role management endpoint (for fixing user roles)
router.post('/fix-role', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    const { role } = req.body;
    
    // Validate role
    if (!['hr', 'hr_manager', 'admin', 'employee', 'team_lead'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Allowed roles: hr, hr_manager, admin, employee, team_lead' });
    }
    
    // Update the current user's role
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', currentUser.id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Role update error:', error);
      return res.status(500).json({ error: 'Failed to update role' });
    }
    
    console.log('✅ Role updated successfully:', { 
      userId: currentUser.id, 
      oldRole: currentUser.role, 
      newRole: role 
    });
    
    res.json({ 
      message: 'Role updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('❌ Fix role endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 