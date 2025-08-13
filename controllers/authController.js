const { supabase, supabaseAdmin } = require('../config/supabase');
const { generatePassword } = require('../utils/passwordGenerator');

// Admin Signup - Only admins can sign up initially
const adminSignup = async (req, res) => {
  try {
    const { email, password, full_name, company_name } = req.body;
    
    console.log('🔍 Admin signup request:', { email, full_name, company_name })
    
    // Check if Supabase is properly configured
    if (!supabaseAdmin || !supabaseAdmin.from) {
      console.error('❌ Supabase not properly configured')
      return res.status(500).json({ error: 'Database not properly configured. Please check environment variables.' });
    }
    
    // Validation is handled by route middleware

    // Check if company already exists (company isolation)
    console.log('🔍 Checking if company already exists...')
    const { data: existingCompany, error: companyCheckError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('name', company_name)
      .single();

    if (companyCheckError && companyCheckError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing company:', companyCheckError)
      return res.status(500).json({ error: 'Failed to check existing company: ' + companyCheckError.message });
    }

    if (existingCompany) {
      console.log('❌ Company already exists:', existingCompany.name)
      return res.status(403).json({ error: 'Company already exists. Please use a different company name or contact support.' });
    }

    // Check if this email is already registered (user isolation)
    console.log('🔍 Checking if email already exists...')
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing user:', userCheckError)
      return res.status(500).json({ error: 'Failed to check existing user: ' + userCheckError.message });
    }

    if (existingUser) {
      console.log('❌ Email already registered:', existingUser.email)
      return res.status(403).json({ error: 'Email already registered. Please use a different email address.' });
    }

    // Create company
    console.log('🔍 Creating company:', company_name)
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: company_name }])
      .select()
      .single();

    if (companyError) {
      console.error('❌ Company creation error:', companyError)
      return res.status(500).json({ error: 'Failed to create company: ' + companyError.message });
    }
    
    console.log('✅ Company created:', company)

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create admin user in our users table
    console.log('🔍 Creating user record in database:', {
      id: authData.user.id,
      full_name,
      email,
      role: 'admin',
      company_id: company.id
    })
    
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        full_name: full_name,
        email: email,
        role: 'admin',
        company_id: company.id,
        is_active: true
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ User record creation error:', userError)
      // If user creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create user in database: ' + userError.message });
    }
    
    console.log('✅ User record created:', userRecord)
    
    console.log('✅ Admin signup completed successfully')
    res.status(201).json({
      message: 'Company and admin user created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
        role: 'admin',
        company_id: company.id
      },
      company: {
        id: company.id,
        name: company.name
      }
    });

  } catch (error) {
    console.error('❌ Admin signup exception:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};

// Add HR Manager (Admin only)
const addHRManager = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    const currentUser = req.user;

    // Check if current user is admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add HR managers' });
    }

    // Validation is handled by route middleware

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create HR manager in our users table
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        full_name: full_name,
        email: email,
        role: 'hr_manager',
        company_id: currentUser.company_id,
        created_by: currentUser.id,
        is_active: true
      }])
      .select()
      .single();

    if (userError) {
      // If user creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create HR manager in database' });
    }
    
    res.status(201).json({
      message: 'HR Manager added successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
        role: 'hr_manager',
        company_id: currentUser.company_id
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add HR Staff (Admin or HR Manager)
const addHRStaff = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    const currentUser = req.user;

    // Check if current user is admin or HR manager
    if (!['admin', 'hr_manager'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Only admins and HR managers can add HR staff' });
    }

    // Validation is handled by route middleware

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create HR staff in our users table
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        full_name: full_name,
        email: email,
        role: 'hr',
        company_id: currentUser.company_id,
        created_by: currentUser.id,
        is_active: true
      }])
      .select()
      .single();

    if (userError) {
      // If user creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create HR staff in database' });
    }
    
    res.status(201).json({
      message: 'HR Staff added successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
        role: 'hr',
        company_id: currentUser.company_id
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation for login
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Supabase authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user details from our users table using admin client to bypass RLS
    let { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If user doesn't exist in users table, create it
    if (userError || !userData) {
      
      // Get or create company
      let { data: company } = await supabaseAdmin
        .from('companies')
        .select('*')
        .limit(1)
        .single();

      if (!company) {
        const { data: newCompany } = await supabaseAdmin
          .from('companies')
          .insert([{ name: 'Default Company' }])
          .select()
          .single();
        company = newCompany;
      }

      // Create user record
      const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: authData.user.id,
          full_name: authData.user.email.split('@')[0],
          email: authData.user.email,
          role: 'employee',
          company_id: company.id,
          is_active: true
        }])
        .select()
        .single();

      if (createUserError) {
        return res.status(500).json({ error: 'Failed to create user record' });
      }

      userData = newUser;
    }

    res.json({
      user: userData,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, company_id, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  adminSignup,
  addHRManager,
  addHRStaff,
  login,
  logout,
  getProfile,
  refreshToken
}; 