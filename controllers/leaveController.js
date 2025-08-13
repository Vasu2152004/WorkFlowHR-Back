const { supabase, supabaseAdmin } = require('../config/supabase')
const emailService = require('../utils/emailService')
const { calculateLeaveDays } = require('../utils/workingDaysCalculator')

// Get leave types
const getLeaveTypes = async (req, res) => {
  try {
    // Try to fetch from database first using admin client to bypass RLS
    const { data: dbLeaveTypes, error } = await supabaseAdmin
      .from('leave_types')
      .select('*')
      .order('name')
    
    if (!error && dbLeaveTypes && dbLeaveTypes.length > 0) {
      // Remove duplicates by name and add max_days for compatibility with frontend
      const uniqueTypes = []
      const seenNames = new Set()
      
      dbLeaveTypes.forEach(type => {
        if (!seenNames.has(type.name)) {
          seenNames.add(type.name)
          uniqueTypes.push({
            ...type,
            max_days: type.name === 'Annual Leave' ? 20 : 
                      type.name === 'Sick Leave' ? 10 : 
                      type.name === 'Personal Leave' ? 5 : 10
          })
        }
      })
      
      return res.json(uniqueTypes)
    }
    
    // Fallback to hardcoded types if database is empty
    const fallbackTypes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Annual Leave',
        description: 'Regular annual leave with full pay',
        is_paid: true,
        max_days: 20
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Sick Leave',
        description: 'Medical leave with full pay',
        is_paid: true,
        max_days: 10
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Personal Leave',
        description: 'Personal leave without pay',
        is_paid: false,
        max_days: 5
      }
    ]
    
    res.json(fallbackTypes)
  } catch (error) {
    console.error('Get leave types error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get leave balance for employee
const getLeaveBalance = async (req, res) => {
  try {
    const { employee_id } = req.params
    const currentUser = req.user
    
    console.log('🔍 getLeaveBalance called with:', {
      employee_id,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        company_id: currentUser.company_id,
        email: currentUser.email
      }
    })

    // Determine which employee to get balance for
    let targetEmployeeId = employee_id
    
    if (!targetEmployeeId) {
      // If no employee_id provided, get current user's employee record
      console.log('🔍 Getting employee record for user_id:', currentUser.id)
      const { data: employee, error: empError } = await supabaseAdmin  // Use admin client to bypass RLS
        .from('employees')
        .select('id, company_id')
        .eq('user_id', currentUser.id)
        .single()

      console.log('🔍 Employee query result:', { employee, empError })

      if (empError || !employee) {
        // If no employee record found, create one for the current user
        console.log('⚠️ Employee record not found, creating one for user:', currentUser.id)
        
        try {
          const { data: newEmployee, error: createError } = await supabaseAdmin
            .from('employees')
            .insert([{
              user_id: currentUser.id,
              full_name: currentUser.full_name || currentUser.email.split('@')[0],
              email: currentUser.email,
              company_id: currentUser.company_id,
              role: currentUser.role,
              is_active: true
            }])
            .select('id, company_id')
            .single()
          
          if (createError) {
            console.error('❌ Failed to create employee record:', createError)
            return res.status(500).json({ error: 'Failed to create employee record', details: createError.message })
          }
          
          targetEmployeeId = newEmployee.id
          console.log('✅ Created employee record with ID:', targetEmployeeId)
        } catch (createError) {
          console.error('❌ Exception creating employee record:', createError)
          return res.status(500).json({ error: 'Failed to create employee record', details: createError.message })
        }
      } else {
        targetEmployeeId = employee.id
        console.log('✅ Found existing employee ID:', targetEmployeeId)
      }
    }

    // For company isolation, use the current user's company_id
    // Admin and HR users can view leave balances for employees in their company
    console.log('🔍 Using current user company_id for isolation:', currentUser.company_id)
    
    // If the target employee is different from current user, verify they belong to the same company
    if (targetEmployeeId !== currentUser.id) {
      // Check if the target employee belongs to the same company
      const { data: targetEmployee, error: targetError } = await supabaseAdmin
        .from('employees')
        .select('company_id')
        .eq('id', targetEmployeeId)
        .single()
      
      if (targetError || !targetEmployee) {
        console.error('❌ Target employee not found:', targetError)
        return res.status(404).json({ error: 'Target employee not found' })
      }
      
      // Verify company isolation
      if (targetEmployee.company_id !== currentUser.company_id) {
        console.error('❌ Company isolation violation: target employee company_id:', targetEmployee.company_id, 'current user company_id:', currentUser.company_id)
        return res.status(403).json({ error: 'Access denied to this employee' })
      }
      
      console.log('✅ Company isolation verified for target employee')
    }

    // Get current year
    const currentYear = new Date().getFullYear()
    console.log('🔍 Getting leave balances for year:', currentYear)

    // Query the leave_balances table directly
    console.log('🔍 Querying leave_balances table for employee:', targetEmployeeId, 'year:', currentYear)
    let leaveBalances = []
    
    try {
      // Query the leave_balances table
      const { data: balanceData, error: balanceError } = await supabaseAdmin
        .from('leave_balances')
        .select(`
          *,
          leave_types (
            id,
            name,
            description,
            is_paid
          )
        `)
        .eq('employee_id', targetEmployeeId)
        .eq('year', currentYear)

      if (balanceError) {
        console.error('❌ Error querying leave_balances table:', balanceError)
        return res.status(500).json({ error: 'Failed to fetch leave balances', details: balanceError.message })
      }

      leaveBalances = balanceData || []
      console.log('🔍 Leave balances found in table:', leaveBalances.length)
      
      // If no balances found, create default balances for this employee
      if (leaveBalances.length === 0) {
        console.log('⚠️ No leave balances found, creating default balances...')
        
        // Get all leave types
        const { data: leaveTypes, error: typesError } = await supabaseAdmin
          .from('leave_types')
          .select('id, name, description, is_paid')
          .order('name')

        if (typesError) {
          console.error('❌ Error fetching leave types:', typesError)
          return res.status(500).json({ error: 'Failed to fetch leave types' })
        }

        console.log('🔍 Creating default balances for leave types:', leaveTypes.length)
        
        // Create default balances for each leave type
        const defaultBalances = leaveTypes.map(leaveType => ({
          employee_id: targetEmployeeId,
          leave_type_id: leaveType.id,
          year: currentYear,
          total_days: leaveType.is_paid ? 20 : (leaveType.name === 'Personal Leave' ? 5 : 10),
          used_days: 0,
          remaining_days: leaveType.is_paid ? 20 : (leaveType.name === 'Personal Leave' ? 5 : 10)
        }))
        
        // Insert default balances
        const { data: insertedBalances, error: insertError } = await supabaseAdmin
          .from('leave_balances')
          .insert(defaultBalances)
          .select(`
            *,
            leave_types (
              id,
              name,
              description,
              is_paid
            )
          `)

        if (insertError) {
          console.error('❌ Error creating default leave balances:', insertError)
          // Continue with fallback calculation
          throw new Error('Failed to create default balances')
        }
        
        leaveBalances = insertedBalances || []
        console.log('✅ Created default leave balances:', leaveBalances.length)
      }
      
    } catch (error) {
      console.log('⚠️ Error with leave_balances table, using fallback calculation method:', error.message)
      
      // Fallback: Calculate from leave_requests and leave_types
      console.log('🔍 Using fallback calculation method...')
      
      // Get all leave types
      const { data: leaveTypes, error: typesError } = await supabaseAdmin
        .from('leave_types')
        .select('id, name, description, is_paid')
        .order('name')

      if (typesError) {
        console.error('❌ Error fetching leave types:', typesError)
        return res.status(500).json({ error: 'Failed to fetch leave types' })
      }

      console.log('🔍 Calculating balances for leave types:', leaveTypes.length)

      // Calculate balances for each leave type
      for (const leaveType of leaveTypes) {
        // Get approved leave requests for this type in current year
        const { data: usedLeaves, error: usedError } = await supabaseAdmin
          .from('leave_requests')
          .select('total_days')
          .eq('employee_id', targetEmployeeId)
          .eq('leave_type_id', leaveType.id)
          .eq('status', 'approved_by_hr')
          .gte('start_date', `${currentYear}-01-01`)
          .lte('end_date', `${currentYear}-12-31`)

        if (usedError) {
          console.error(`Error fetching used leaves for ${leaveType.name}:`, usedError)
          continue
        }

        const usedDays = usedLeaves?.reduce((sum, leave) => sum + (leave.total_days || 0), 0) || 0
        
        // For paid leave types, use default balance
        // For unpaid leave types, show fixed allocation
        let totalDays, remainingDays
        
        if (leaveType.is_paid) {
          // For paid leaves, use default balance
          totalDays = 20 + usedDays
          remainingDays = 20
        } else {
          // For unpaid leaves, show fixed allocation
          totalDays = leaveType.name === 'Personal Leave' ? 5 : 10
          remainingDays = Math.max(0, totalDays - usedDays)
        }

        leaveBalances.push({
          leave_type_id: leaveType.id,
          leave_types: leaveType,
          total_days: totalDays,
          used_days: usedDays,
          remaining_days: remainingDays
        })
      }
    }

    // Transform the data for frontend
    const balances = leaveBalances.map(balance => ({
      leave_type_id: balance.leave_type_id,
      leave_type_name: balance.leave_types?.name || 'Unknown',
      total_days: balance.total_days || 0,
      used_days: balance.used_days || 0,
      remaining_days: balance.remaining_days || 0,
      is_paid: balance.leave_types?.is_paid || false
    }))

    console.log('✅ Returning leave balances:', balances)

    res.json({ balances })
  } catch (error) {
    console.error('❌ Get leave balance error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Create leave request
const createLeaveRequest = async (req, res) => {
  try {
    const { leave_type_id, start_date, end_date, reason, employee_id } = req.body
    const currentUser = req.user

    // Validate required fields
    if (!leave_type_id || !start_date || !end_date || !reason) {
      return res.status(400).json({ 
        error: 'Leave type, start date, end date, and reason are required' 
      })
    }

    // Validate dates
    const start = new Date(start_date)
    const end = new Date(end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (start < today) {
      return res.status(400).json({ 
        error: 'Start date cannot be in the past' 
      })
    }

    if (end < start) {
      return res.status(400).json({ 
        error: 'End date cannot be before start date' 
      })
    }

    // Get employee details
    let employee = null
    if (['hr', 'hr_manager', 'admin'].includes(currentUser.role)) {
      // HR users can create leave requests for any employee
      if (!employee_id) {
        return res.status(400).json({ 
          error: 'Employee ID is required for HR users' 
        })
      }
      
      const { data: empData, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id, team_lead_id, created_by, company_id')
        .eq('id', employee_id)
        .single()
      
      if (empErr || !empData) {
        return res.status(400).json({ error: 'Employee not found' })
      }
      
      // Apply company isolation for HR users
      if (empData.company_id !== currentUser.company_id) {
        return res.status(403).json({ error: 'Access denied to this employee' })
      }
      
      employee = empData
    } else {
      // Regular employees can only create leave requests for themselves
      console.log('🔍 Looking for employee record with user_id:', currentUser.id)
      const { data: empData, error: empErr } = await supabaseAdmin  // Use admin client to bypass RLS
        .from('employees')
        .select('id, team_lead_id, created_by')
        .eq('user_id', currentUser.id)
        .single()
      
      console.log('🔍 Employee query result:', { empData, empErr })
      
      if (empErr || !empData) {
        console.error('❌ Employee not found for user_id:', currentUser.id, 'Error:', empErr)
        return res.status(400).json({ error: 'Employee not found' })
      }
      employee = empData
      console.log('✅ Found employee:', employee)
    }

    // Get employee's company_id for isolation
    console.log('🔍 Getting company_id for employee:', employee.id)
    const { data: employeeWithCompany, error: companyError } = await supabaseAdmin  // Use admin client to bypass RLS
      .from('employees')
      .select('company_id')
      .eq('id', employee.id)
      .single()

    console.log('🔍 Company query result:', { employeeWithCompany, companyError })

    if (companyError || !employeeWithCompany) {
      console.error('❌ Employee company not found for employee_id:', employee.id, 'Error:', companyError)
      return res.status(400).json({ error: 'Employee company not found' })
    }
    
    console.log('✅ Found employee company:', employeeWithCompany)

    // Calculate total days (respecting company working days configuration)
    console.log('🔍 Calculating leave days for company:', employeeWithCompany.company_id, 'from', start, 'to', end)
    const totalDays = await calculateLeaveDays(employeeWithCompany.company_id, start, end)
    console.log('✅ Calculated total days:', totalDays)

    // Validate leave type exists using admin client to bypass RLS
    console.log('🔍 Validating leave type:', leave_type_id)
    const { data: leaveType, error: leaveTypeError } = await supabaseAdmin
      .from('leave_types')
      .select('id, name')
      .eq('id', leave_type_id)
      .single()

    console.log('🔍 Leave type validation result:', { leaveType, leaveTypeError })

    if (leaveTypeError || !leaveType) {
      console.error('❌ Invalid leave type:', leave_type_id, 'Error:', leaveTypeError)
      return res.status(400).json({ 
        error: 'Invalid leave type. Please select a valid leave type.' 
      })
    }
    
    console.log('✅ Leave type validated:', leaveType)

    // Validate required fields
    if (!employee.team_lead_id) {
      console.warn('⚠️ No team_lead_id for employee:', employee.id)
    }
    if (!employee.created_by) {
      console.warn('⚠️ No created_by for employee:', employee.id)
    }

    // Create leave request with company_id
    const leaveRequestData = {
      employee_id: employee.id,
      leave_type_id,
      start_date: start,
      end_date: end,
      total_days: totalDays,
      reason: reason.trim(),
      status: 'pending',
      team_lead_id: employee.team_lead_id || null,
      hr_id: employee.created_by || null,
      company_id: employeeWithCompany.company_id
    }
    
    console.log('🔍 Creating leave request with data:', leaveRequestData)
    
    // Test database connection first
    console.log('🔍 Testing database connection...')
    try {
      const { data: testData, error: testError } = await supabaseAdmin
        .from('leave_requests')
        .select('count')
        .limit(1)
      
      if (testError) {
        console.error('❌ Database connection test failed:', testError)
        return res.status(500).json({ 
          error: 'Database connection failed',
          details: testError.message 
        })
      }
      console.log('✅ Database connection test passed')
    } catch (testError) {
      console.error('❌ Database connection test exception:', testError)
      return res.status(500).json({ 
        error: 'Database connection exception',
        details: testError.message 
      })
    }
    
    const { data: leaveRequest, error } = await supabaseAdmin  // Use admin client to bypass RLS
      .from('leave_requests')
      .insert(leaveRequestData)
      .select('*')
      .single()

    if (error) {
      console.error('❌ Create leave request database error:', error)
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return res.status(500).json({ 
        error: 'Failed to create leave request',
        details: error.message 
      })
    }
    
    console.log('✅ Leave request created successfully:', leaveRequest)

    // Update leave balances for this employee and leave type
    try {
      console.log('🔍 Updating leave balances for employee:', employee.id, 'leave type:', leave_type_id)
      
      // Get current year
      const currentYear = new Date().getFullYear()
      
      // Check if leave balance record exists
      const { data: existingBalance, error: balanceCheckError } = await supabaseAdmin
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('leave_type_id', leave_type_id)
        .eq('year', currentYear)
        .single()
      
      if (balanceCheckError && balanceCheckError.code !== 'PGRST116') {
        console.error('❌ Error checking existing leave balance:', balanceCheckError)
      }
      
      if (existingBalance) {
        // Update existing balance - reduce remaining days
        const { error: updateError } = await supabaseAdmin
          .from('leave_balances')
          .update({
            used_days: existingBalance.used_days + totalDays,
            remaining_days: Math.max(0, existingBalance.remaining_days - totalDays),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBalance.id)
        
        if (updateError) {
          console.error('❌ Error updating leave balance:', updateError)
        } else {
          console.log('✅ Leave balance updated successfully')
        }
      } else {
        // Create new balance record if it doesn't exist
        const { error: createError } = await supabaseAdmin
          .from('leave_balances')
          .insert({
            employee_id: employee.id,
            leave_type_id: leave_type_id,
            year: currentYear,
            total_days: leaveType.is_paid ? 20 : (leaveType.name === 'Personal Leave' ? 5 : 10),
            used_days: totalDays,
            remaining_days: Math.max(0, (leaveType.is_paid ? 20 : (leaveType.name === 'Personal Leave' ? 5 : 10)) - totalDays)
          })
        
        if (createError) {
          console.error('❌ Error creating leave balance:', createError)
        } else {
          console.log('✅ Leave balance record created successfully')
        }
      }
    } catch (balanceError) {
      console.error('❌ Error updating leave balances:', balanceError)
      // Don't fail the request if balance update fails
    }

    // Send email notification to HR
    try {
      const hrEmails = await emailService.getHREmails(employeeWithCompany.company_id)
      if (hrEmails.length > 0) {
        await emailService.sendLeaveRequestNotification(leaveRequest, hrEmails)
        console.log('✅ Email notification sent to HR:', hrEmails)
      } else {
        console.log('⚠️ No HR emails found for company:', employeeWithCompany.company_id)
      }
    } catch (emailError) {
      console.log('Email notification failed, but leave request created successfully:', emailError.message)
    }

    res.status(201).json({ 
      message: 'Leave request created successfully. Pending approval.',
      leaveRequest 
    })

  } catch (error) {
    console.error('Create leave request error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get leave requests
const getLeaveRequests = async (req, res) => {
  try {
    const { status, employee_id } = req.query
    const currentUser = req.user
    
    console.log('🔍 getLeaveRequests called with:', {
      userRole: currentUser.role,
      userCompanyId: currentUser.company_id,
      requestedEmployeeId: employee_id,
      statusFilter: status
    })

    let query = supabaseAdmin
      .from('leave_requests')
      .select(`
        id,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        status,
        created_at,
        company_id,
        employees!inner (
          id,
          full_name,
          email
        ),
        leave_types!inner (
          id,
          name,
          description
        )
      `)
      .order('created_at', { ascending: false })

    // Apply company isolation based on user role
    if (currentUser.role === 'employee') {
      // Get employee ID for the current user
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('user_id', currentUser.id)
        .single()

      if (empError || !employee) {
        return res.status(404).json({ error: 'Employee record not found' })
      }
      
      query = query.eq('employee_id', employee.id)
    } else if (['hr', 'hr_manager', 'admin'].includes(currentUser.role)) {
      // ALL users (including admin) can only see leave requests from their company
      query = query.eq('company_id', currentUser.company_id)
      
      // If specific employee is requested, verify they belong to the same company
      if (employee_id) {
        const { data: employee, error: empError } = await supabaseAdmin
          .from('employees')
          .select('company_id')
          .eq('id', employee_id)
          .single()

        if (empError || !employee || employee.company_id !== currentUser.company_id) {
          return res.status(403).json({ error: 'Access denied to this employee' })
        }
        
        query = query.eq('employee_id', employee_id)
      }
    } else {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    console.log('🔍 Executing optimized leave requests query...')
    const { data: leaveRequests, error } = await query

    if (error) {
      console.error('❌ Get leave requests error:', error)
      return res.status(500).json({ error: 'Failed to fetch leave requests' })
    }

    console.log('✅ Leave requests fetched successfully:', leaveRequests?.length || 0)
    res.json(leaveRequests || [])
    
  } catch (error) {
    console.error('❌ Get leave requests error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Update leave request status (HR only)
const updateLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params
    const { status, hr_remarks } = req.body

    // Validate status for HR approval
    if (!['approved_by_hr', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be either approved_by_hr or rejected' 
      })
    }

    // Get the leave request with company isolation
    let query = supabaseAdmin  // Use admin client to bypass RLS
      .from('leave_requests')
      .select('*')
      .eq('id', id)

    // Apply company isolation for ALL users (including admin)
    query = query.eq('company_id', req.user.company_id)

    const { data: leaveRequest, error: fetchError } = await query.single()

    if (fetchError || !leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found or access denied' })
    }

    // Check if already processed by HR
    if (leaveRequest.status === 'approved_by_hr' || leaveRequest.status === 'rejected') {
      return res.status(400).json({ 
        error: 'Leave request has already been processed by HR' 
      })
    }

    // Update the leave request
    const updateData = {
      status,
      hr_remarks: hr_remarks?.trim() || null,
      approved_at: new Date().toISOString(),
      approved_by: req.user.id
    }

    const { data: updatedRequest, error } = await supabaseAdmin  // Use admin client to bypass RLS
      .from('leave_requests')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          leave_balance
        ),
        leave_types (
          id,
          name,
          is_paid
        )
      `)
      .single()

    if (error) {
      console.error('Update leave request error:', error)
      return res.status(500).json({ error: 'Failed to update leave request' })
    }

    // If approved, update leave balances in the leave_balances table
    if (status === 'approved_by_hr') {
      try {
        console.log('🔍 Updating leave balances for approved request:', updatedRequest.id)
        
        // Get current year
        const currentYear = new Date().getFullYear()
        
        // Check if leave balance record exists
        const { data: existingBalance, error: balanceCheckError } = await supabaseAdmin
          .from('leave_balances')
          .select('*')
          .eq('employee_id', updatedRequest.employee_id)
          .eq('leave_type_id', updatedRequest.leave_type_id)
          .eq('year', currentYear)
          .single()
        
        if (balanceCheckError && balanceCheckError.code !== 'PGRST116') {
          console.error('❌ Error checking existing leave balance:', balanceCheckError)
        }
        
        if (existingBalance) {
          // Update existing balance - reduce remaining days
          const { error: updateError } = await supabaseAdmin
            .from('leave_balances')
            .update({
              used_days: existingBalance.used_days + updatedRequest.total_days,
              remaining_days: Math.max(0, existingBalance.remaining_days - updatedRequest.total_days),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingBalance.id)
          
          if (updateError) {
            console.error('❌ Error updating leave balance:', updateError)
          } else {
            console.log(`✅ Leave balance updated for employee ${updatedRequest.employees.full_name}: used ${existingBalance.used_days} → ${existingBalance.used_days + updatedRequest.total_days}, remaining ${existingBalance.remaining_days} → ${Math.max(0, existingBalance.remaining_days - updatedRequest.total_days)}`)
          }
        } else {
          // Create new balance record if it doesn't exist
          const { error: createError } = await supabaseAdmin
            .from('leave_balances')
            .insert({
              employee_id: updatedRequest.employee_id,
              leave_type_id: updatedRequest.leave_type_id,
              year: currentYear,
              total_days: updatedRequest.leave_types?.is_paid ? 20 : (updatedRequest.leave_types?.name === 'Personal Leave' ? 5 : 10),
              used_days: updatedRequest.total_days,
              remaining_days: Math.max(0, (updatedRequest.leave_types?.is_paid ? 20 : (updatedRequest.leave_types?.name === 'Personal Leave' ? 5 : 10)) - updatedRequest.total_days)
            })
          
          if (createError) {
            console.error('❌ Error creating leave balance:', createError)
          } else {
            console.log(`✅ Leave balance record created for employee ${updatedRequest.employees.full_name}`)
          }
        }
      } catch (balanceError) {
        console.error('❌ Error updating leave balances:', balanceError)
        // Don't fail the request, just log the error
      }
    }

    // Send email notification to employee
    try {
      await emailService.sendLeaveStatusUpdate(updatedRequest)
    } catch (emailError) {
      console.log('Email notification failed, but leave request updated successfully:', emailError.message)
    }

    res.json({ 
      message: `Leave request ${status === 'approved_by_hr' ? 'approved' : 'rejected'} successfully`,
      leaveRequest: updatedRequest 
    })

  } catch (error) {
    console.error('Update leave request error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get unpaid leave days for salary calculation
const getUnpaidLeaveDays = async (req, res) => {
  try {
    const { employee_id, month, year } = req.query

    if (!employee_id || !month || !year) {
      return res.status(400).json({ 
        error: 'Employee ID, month, and year are required' 
      })
    }

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    // Get unpaid leave requests for the month
    const { data: unpaidLeaves, error } = await supabaseAdmin  // Use admin client to bypass RLS
      .from('leave_requests')
      .select('total_days, leave_type_id')
      .eq('employee_id', employee_id)
      .eq('status', 'approved_by_hr')
      .gte('start_date', startDate.toISOString().split('T')[0])
      .lte('end_date', endDate.toISOString().split('T')[0])
      .in('leave_type_id', ['550e8400-e29b-41d4-a716-446655440003']) // Only personal leave is unpaid

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch unpaid leave days' })
    }

    const totalUnpaidDays = unpaidLeaves.reduce((sum, leave) => sum + parseInt(leave.total_days), 0)

    res.json({ 
      unpaidLeaves,
      totalUnpaidDays 
    })

  } catch (error) {
    console.error('Get unpaid leave days error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getLeaveTypes,
  getLeaveBalance,
  createLeaveRequest,
  getLeaveRequests,
  updateLeaveRequest,
  getUnpaidLeaveDays
} 