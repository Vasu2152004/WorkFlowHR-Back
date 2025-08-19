const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateEmployeePassword, generateEmployeeId } = require('../utils/passwordGenerator');

// Add employee (HR/HR Manager/Admin only) - Comprehensive creation
const addEmployee = async (req, res) => {
  try {
    const { 
      email, 
      full_name, 
      department, 
      designation, 
      salary, 
      joining_date,
      phone_number,
      address,
      emergency_contact,
      pan_number,
      bank_account,
      leave_balance = 10,
      team_lead_id = null // New field for team lead assignment
    } = req.body;
    
    const currentUser = req.user;

    // Check if user has permission to add employees
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ 
        error: 'Only Admin, HR Manager, and HR can add employees' 
      });
    }

    // Validate required fields
    if (!email || !full_name || !department || !designation || !salary || !joining_date) {
      return res.status(400).json({ 
        error: 'Email, full name, department, designation, salary, and joining date are required' 
      });
    }

    // Validate team lead if provided
    if (team_lead_id) {
      const { data: teamLead, error: teamLeadError } = await supabaseAdmin
        .from('users')
        .select('id, role, company_id')
        .eq('id', team_lead_id)
        .single();

      if (teamLeadError || !teamLead) {
        return res.status(400).json({ error: 'Invalid team lead ID' });
      }

      if (teamLead.role !== 'team_lead') {
        return res.status(400).json({ error: 'Selected user is not a team lead' });
      }

      if (teamLead.company_id !== currentUser.company_id) {
        return res.status(400).json({ error: 'Team lead must be from the same company' });
      }
    }

    // Generate employee ID and password
    const employeeId = generateEmployeeId();
    const employeePassword = generateEmployeePassword();

    // Create employee in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: employeePassword,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create user record in our users table
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        full_name: full_name,
        email: email,
        role: 'employee',
        company_id: currentUser.company_id,
        created_by: currentUser.id,
        is_active: true
      }])
      .select()
      .single();

    if (userError) {
      // If user creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create user record: ' + userError.message });
    }

    // Create comprehensive employee record
    const employeeData = {
      user_id: authData.user.id,
      employee_id: employeeId,
      full_name: full_name,
      email: email,
      department: department,
      designation: designation,
      salary: parseFloat(salary),
      joining_date: joining_date,
      phone_number: phone_number || null,
      address: address || null,
      emergency_contact: emergency_contact || null,
      pan_number: pan_number || null,
      bank_account: bank_account || null,
              leave_balance: parseInt(leave_balance) || 10,
      created_by: currentUser.id, // Track who created this employee
      team_lead_id: team_lead_id, // Team lead assignment
      company_id: currentUser.company_id
    };

    // Insert into employees table using admin client to bypass RLS
    const { data: employeeRecord, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert([employeeData])
      .select()
      .single();

    if (employeeError) {
      // If employee creation fails, delete both auth user and user record
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
      return res.status(500).json({ error: 'Failed to create employee record: ' + employeeError.message });
    }

    // Send welcome email with credentials
    try {
      const emailData = {
        to: email,
        subject: 'Welcome to WorkFlowHR - Your Account Details',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to WorkFlowHR!</h2>
            <p>Dear ${full_name},</p>
            <p>Your employee account has been created successfully. Here are your login credentials:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Your Login Details:</h3>
              <p><strong>Employee ID:</strong> ${employeeId}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${employeePassword}</p>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin-top: 0;">Your Information:</h3>
              <p><strong>Department:</strong> ${department}</p>
              <p><strong>Designation:</strong> ${designation}</p>
              <p><strong>Joining Date:</strong> ${joining_date}</p>
              <p><strong>Leave Balance:</strong> ${leave_balance} days</p>
            </div>
            
            <p><strong>Important:</strong> Please change your password after your first login for security.</p>
            
            <p>Best regards,<br>HR Team</p>
          </div>
        `
      };

      // Send email (this will work if email is configured)
      const emailResponse = await fetch(`${req.protocol}://${req.get('host')}/api/email/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      if (!emailResponse.ok) {
        // Email sending failed, but employee created successfully
      }
    } catch (emailError) {
      // Email functionality not available, but employee created successfully
    }

    res.status(201).json({
      message: 'Employee added successfully',
      employee: {
        id: authData.user.id,
        employee_id: employeeId,
        email: authData.user.email,
        full_name,
        department,
        designation,
        salary: parseFloat(salary),
        joining_date,
        role: 'employee',
        company_id: currentUser.company_id,
        password: employeePassword // Return password for HR reference
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all employees (Role-based access)
const getEmployees = async (req, res) => {
  try {
    const currentUser = req.user;

    // Build base query with proper joins
    let query = supabaseAdmin
      .from('employees')
      .select(`
        *,
        users!employees_user_id_fkey(id, full_name, email, role, company_id, is_active),
        team_lead:users!employees_team_lead_id_fkey(id, full_name, email, role),
        creator:users!employees_created_by_fkey(id, full_name, email, role)
      `);

    // Apply role-based filtering based on hierarchy
    switch (currentUser.role) {
      case 'admin':
        // Admin can see all employees in their company only
        query = query.eq('company_id', currentUser.company_id);
        break;
        
      case 'hr_manager':
        // HR Manager can see all employees in their company
        query = query.eq('company_id', currentUser.company_id);
        break;
        
      case 'hr':
        // HR can see employees in their company
        query = query.eq('company_id', currentUser.company_id);
        break;
        
      case 'team_lead':
        // Team Lead can see their team members
        query = query.eq('team_lead_id', currentUser.id);
        break;
        
      case 'employee':
        // Employee can only see their own data
        query = query.eq('user_id', currentUser.id);
        break;
        
      default:
        return res.status(403).json({ error: 'Access denied' });
    }

    const { data: employees, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Transform the data to include user information
    const transformedEmployees = employees.map(emp => ({
      ...emp,
      user: emp.users,
      team_lead: emp.team_lead,
      creator: emp.creator
    }));

    res.json({ employees: transformedEmployees });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get employee by ID (HR only)
const getEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Build query with role-based access
    let query = supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', id);

    // Apply role-based filtering
    if (currentUser.role === 'hr') {
      // HR can only see employees they created
      query = query.eq('created_by', currentUser.id);
    } else if (currentUser.role === 'hr_manager') {
      // HR Manager can see all employees in their company
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.role === 'team_lead') {
      // Team Lead can see their team members
      query = query.eq('team_lead_id', currentUser.id);
    } else if (currentUser.role === 'admin') {
      // Admin can only see employees in their company
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.role === 'employee') {
      // Employee can only see their own data
      query = query.eq('user_id', currentUser.id);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: employee, error } = await query.single();

    if (error || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update employee (HR only)
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const { 
      full_name, 
      email, 
      department, 
      designation, 
      salary, 
      joining_date,
      phone_number,
      address,
      emergency_contact,
      pan_number,
      bank_account,
      leave_balance
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !department || !designation || !salary || !joining_date) {
      return res.status(400).json({ 
        error: 'Full name, email, department, designation, salary, and joining date are required' 
      });
    }

    // Check if user has permission to update employees
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if employee exists and user has access
    let query = supabaseAdmin
      .from('employees')
      .select('id, created_by, company_id')
      .eq('id', id);

    // Apply role-based filtering for access check
    if (currentUser.role === 'hr') {
      query = query.eq('created_by', currentUser.id);
    } else if (currentUser.role === 'hr_manager') {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.role === 'admin') {
      // Admin can only access employees in their company
      query = query.eq('company_id', currentUser.company_id);
    }

    const { data: existingEmployee, error: checkError } = await query.single();

    if (checkError || !existingEmployee) {
      return res.status(404).json({ error: 'Employee not found or access denied' });
    }

    // Update employee using admin client to bypass RLS
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .update({ 
        full_name, 
        email,
        department,
        designation,
        salary: parseFloat(salary),
        joining_date,
        phone_number: phone_number || null,
        address: address || null,
        emergency_contact: emergency_contact || null,
        pan_number: pan_number || null,
        bank_account: bank_account || null,
        leave_balance: parseInt(leave_balance) || 10
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update employee' });
    }

    res.json({ 
      message: 'Employee updated successfully',
      employee 
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete employee (Admin/HR Manager/HR only)
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user has permission to delete employees
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if employee exists and user has access
    let query = supabaseAdmin
      .from('employees')
      .select('id, user_id, created_by, company_id')
      .eq('id', id);

    // Apply role-based filtering for access check
    if (currentUser.role === 'hr') {
      query = query.eq('created_by', currentUser.id);
    } else if (currentUser.role === 'hr_manager') {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.role === 'admin') {
      // Admin can only access employees in their company
      query = query.eq('company_id', currentUser.company_id);
    }

    const { data: existingEmployee, error: checkError } = await query.single();

    if (checkError || !existingEmployee) {
      return res.status(404).json({ error: 'Employee not found or access denied' });
    }

    // Delete from employees table
    const { error: employeeError } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (employeeError) {
      return res.status(500).json({ error: 'Failed to delete employee' });
    }

    // Delete user from Supabase Auth (this will cascade to our users table)
    if (existingEmployee.user_id) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(existingEmployee.user_id);
      if (authError) {
        // Continue even if auth deletion fails, as the employee record is already deleted
      }
    }

    res.json({ message: 'Employee deleted successfully' });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset employee password (Admin/HR Manager/HR only)
const resetEmployeePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user has permission to reset employee passwords
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if employee exists and user has access
    let query = supabaseAdmin
      .from('employees')
      .select('id, user_id, email, created_by, company_id')
      .eq('id', id);

    // Apply role-based filtering for access check
    if (currentUser.role === 'hr') {
      query = query.eq('created_by', currentUser.id);
    } else if (currentUser.role === 'hr_manager') {
      query = query.eq('company_id', currentUser.company_id);
    } else if (currentUser.role === 'admin') {
      // Admin can only access employees in their company
      query = query.eq('company_id', currentUser.company_id);
    }

    const { data: existingEmployee, error: checkError } = await query.single();

    if (checkError || !existingEmployee) {
      return res.status(404).json({ error: 'Employee not found or access denied' });
    }

    // Generate new password
    const newPassword = generateEmployeePassword();

    // Update password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(existingEmployee.user_id, {
      password: newPassword
    });

    if (authError) {
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    // Password is stored in Supabase Auth, not in employees table
    // No need to update employees table

    res.json({ 
      message: 'Employee password reset successfully',
      new_password: newPassword
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get company profile (accessible by all authenticated users)
const getCompanyProfile = async (req, res) => {
  try {
    
    let { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.user.company_id)
      .single();

    if (error || !company) {
      
      // Create a default company profile
      const { data: newCompany, error: createError } = await supabaseAdmin
        .from('companies')
        .insert([{
          id: req.user.company_id,
          name: 'Your Company Name',
          email: 'contact@company.com',
          address: 'Company Address',
          phone: '+1234567890',
          website: 'https://company.com'
        }])
        .select('*')
        .single();

      if (createError) {
        return res.status(500).json({ error: 'Failed to create company profile' });
      }

      company = newCompany;
    }

    res.json({ company });
  } catch (error) {
    console.error('❌ Company profile fetch exception:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};

// Update company profile (HR only)
const updateCompanyProfile = async (req, res) => {
  try {
    console.log('🔍 Company profile update request:', {
      user: req.user,
      body: req.body,
      company_id: req.user.company_id
    });
    
    const { 
      name, 
      website, 
      phone, 
      address, 
      email
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        error: 'Company name is required' 
      });
    }
    
    if (!req.user.company_id) {
      return res.status(400).json({ 
        error: 'Company ID not found in user data' 
      });
    }

    // Update company profile - only update columns that exist in the table
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .update({ 
        name,
        website: website || null,
        phone: phone || null,
        address: address || null,
        email: email || null
      })
      .eq('id', req.user.company_id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Company profile update error:', error);
      return res.status(500).json({ error: 'Failed to update company profile: ' + error.message });
    }

    res.json({ 
      message: 'Company profile updated successfully',
      company 
    });

  } catch (error) {
    console.error('❌ Company profile update exception:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};

// Get employees for viewing (accessible by all authenticated users)
const getEmployeesForViewing = async (req, res) => {
  try {
    
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, user_id, employee_id, full_name, email, department, designation, phone_number, joining_date, company_id, created_at')
      .eq('company_id', req.user.company_id)
      .order('full_name', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }

    res.json({ employees });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create employee record for existing user (if missing)
const createEmployeeRecordForUser = async (req, res) => {
  try {
    console.log('🔍 createEmployeeRecordForUser called with user:', req.user)
    const currentUser = req.user;
    
    // Check if user already has an employee record
    console.log('🔍 Checking for existing employee record with user_id:', currentUser.id)
    const { data: existingEmployee, error: checkError } = await supabaseAdmin
      .from('employees')
      .select('id, user_id')
      .eq('user_id', currentUser.id)
      .single();

    console.log('🔍 Existing employee check result:', { existingEmployee, checkError })

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing employee record:', checkError);
      return res.status(500).json({ error: 'Failed to check existing employee record' });
    }

    if (existingEmployee) {
      console.log('✅ Employee record already exists:', existingEmployee)
      return res.status(200).json({ 
        message: 'Employee record already exists',
        employee: existingEmployee
      });
    }

    console.log('🔍 No existing employee record found, creating new one...')

    // Generate employee ID
    const employeeId = generateEmployeeId();
    console.log('🔍 Generated employee ID:', employeeId)

    // Create employee record
    const employeeData = {
      user_id: currentUser.id,
      employee_id: employeeId,
      full_name: currentUser.full_name,
      email: currentUser.email,
      department: currentUser.role === 'admin' ? 'Management' : 
                 currentUser.role === 'hr_manager' ? 'HR' : 
                 currentUser.role === 'hr' ? 'HR' : 'General',
      designation: currentUser.role === 'admin' ? 'Administrator' : 
                  currentUser.role === 'hr_manager' ? 'HR Manager' : 
                  currentUser.role === 'hr' ? 'HR Staff' : 'Employee',
      salary: 0, // Default salary for non-employee roles
      joining_date: new Date().toISOString().split('T')[0],
      company_id: currentUser.company_id,
      created_by: currentUser.id
      // Removed is_active and leave_balance as they don't exist in the table
    }

    console.log('🔍 Creating employee record with data:', employeeData)

    const { data: newEmployee, error: createError } = await supabaseAdmin
      .from('employees')
      .insert([employeeData])
      .select()
      .single();

    if (createError) {
      console.error('Error creating employee record:', createError);
      return res.status(500).json({ error: 'Failed to create employee record: ' + createError.message });
    }

    console.log('✅ Created employee record for user:', currentUser.id, 'Employee ID:', newEmployee.id);

    res.status(201).json({
      message: 'Employee record created successfully',
      employee: newEmployee
    });

  } catch (error) {
    console.error('Error in createEmployeeRecordForUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  addEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  getCompanyProfile,
  updateCompanyProfile,
  getEmployeesForViewing,
  createEmployeeRecordForUser
}; 