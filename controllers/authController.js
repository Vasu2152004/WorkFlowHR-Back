const { supabase, supabaseAdmin } = require('../config/supabase');
const { generatePassword } = require('../utils/passwordGenerator');

// Admin Signup - Only admins can sign up initially
const adminSignup = async (req, res) => {
  try {
    const { email, password, full_name, company_name } = req.body;
    

    
    // Check if Supabase is properly configured
    if (!supabaseAdmin || !supabaseAdmin.from) {
      console.error('❌ Supabase not properly configured')
      return res.status(500).json({ error: 'Database not properly configured. Please check environment variables.' });
    }
    
    // Validation is handled by route middleware

    // Check if company already exists (company isolation)

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
              console.log('Company already exists:', existingCompany.name)
      return res.status(403).json({ error: 'Company already exists. Please use a different company name or contact support.' });
    }

    // Check if this email is already registered (user isolation)
    
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
              console.log('Email already registered:', existingUser.email)
      return res.status(403).json({ error: 'Email already registered. Please use a different email address.' });
    }

    // Create company
    
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: company_name }])
      .select()
      .single();

    if (companyError) {
      console.error('❌ Company creation error:', companyError)
      return res.status(500).json({ error: 'Failed to create company: ' + companyError.message });
    }
    
    

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

    // Get company info
    let company = null;
    if (user.company_id) {
      const { data: companyData, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();

      if (!companyError && companyData) {
        company = companyData;
      }
    }

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        company_name: company?.name || 'Unknown Company',
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
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

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const { data: existingUser, error: emailCheckError } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already taken by another user' });
      }
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name: full_name || undefined,
        email: email || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Profile update error:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    // If email was changed, update Supabase Auth as well
    if (email && email !== req.user.email) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: email
      });

      if (authUpdateError) {
        console.error('❌ Auth email update error:', authUpdateError);
        // Don't fail the request, just log the error
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        company_id: updatedUser.company_id,
        is_active: updatedUser.is_active,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Profile update exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change user password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const { data: { user: authUser }, error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword
    });

    if (signInError || !authUser) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password in Supabase Auth
    const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (passwordUpdateError) {
      console.error('❌ Password update error:', passwordUpdateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Password change exception:', error);
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
  updateProfile,
  changePassword,
  refreshToken
}; 