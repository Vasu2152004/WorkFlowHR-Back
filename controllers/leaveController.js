const { supabase, supabaseAdmin } = require('../config/supabase')
const emailService = require('../utils/emailService')
const { calculateLeaveDays } = require('../utils/workingDaysCalculator')

// PERMANENT SOLUTION: Automatic duplicate prevention and cleanup system
// This system automatically prevents duplicates from being created and cleans up any existing ones

// IMPORTANT: To prevent future duplicate leave balance records, consider adding this database constraint:
// ALTER TABLE leave_balances ADD CONSTRAINT unique_employee_leave_type_year 
// UNIQUE (employee_id, leave_type_id, year);

// Automatic cleanup function that runs on server startup
const performGlobalCleanup = async () => {
  try {
    console.log('🧹 PERMANENT SOLUTION: Starting global duplicate cleanup...')
    
    // Get ALL leave balance records from the database
    const { data: allBalances, error: fetchError } = await supabaseAdmin
      .from('leave_balances')
      .select('id, employee_id, leave_type_id, year, created_at')
    
    if (fetchError) {
      console.error('❌ Global cleanup: Error fetching all balances:', fetchError)
      return
    }
    
    if (!allBalances || allBalances.length === 0) {
      console.log('✅ Global cleanup: No leave balance records found')
      return
    }
    
    console.log(`🔍 Global cleanup: Found ${allBalances.length} total leave balance records`)
    
    // Group by employee_id, leave_type_id, and year to find duplicates
    const groupedBalances = {}
    allBalances.forEach(balance => {
      const key = `${balance.employee_id}-${balance.leave_type_id}-${balance.year}`
      if (!groupedBalances[key]) {
        groupedBalances[key] = []
      }
      groupedBalances[key].push(balance)
    })
    
    // Find and delete duplicates, keeping only the oldest record
    let totalCleaned = 0
    let totalGroups = 0
    
    for (const [key, balances] of Object.entries(groupedBalances)) {
      if (balances.length > 1) {
        totalGroups++
        console.log(`🧹 Global cleanup: Found ${balances.length} duplicate records for key ${key}`)
        
        // Sort by created_at to keep the oldest
        balances.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
        
        // Keep the first (oldest) record, delete the rest
        const duplicatesToDelete = balances.slice(1).map(b => b.id)
        
        try {
          const { error: deleteError } = await supabaseAdmin
            .from('leave_balances')
            .delete()
            .in('id', duplicatesToDelete)
          
          if (deleteError) {
            console.warn('⚠️ Global cleanup: Failed to delete duplicates for key:', key, deleteError)
          } else {
            totalCleaned += duplicatesToDelete.length
            console.log(`✅ Global cleanup: Deleted ${duplicatesToDelete.length} duplicate records for key ${key}`)
          }
        } catch (deleteError) {
          console.warn('⚠️ Global cleanup: Error deleting duplicates for key:', key, deleteError)
        }
      }
    }
    
    console.log(`✅ PERMANENT SOLUTION: Global cleanup completed. Total groups with duplicates: ${totalGroups}, Total records cleaned: ${totalCleaned}`)
    
  } catch (error) {
    console.error('❌ Global cleanup error:', error)
  }
}

// Run global cleanup on module load (server startup)
performGlobalCleanup()

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
    } else {
      // Check if the provided employee_id is actually a user_id
      // First try to find an employee record with this ID
      let { data: employeeRecord, error: empRecordError } = await supabaseAdmin
        .from('employees')
        .select('id, company_id')
        .eq('id', targetEmployeeId)
        .single()
      
      if (empRecordError || !employeeRecord) {
        // If not found, try to find an employee record with this user_id
        console.log('🔍 Employee ID not found, trying to find by user_id:', targetEmployeeId)
        const { data: employeeByUserId, error: empByUserIdError } = await supabaseAdmin
          .from('employees')
          .select('id, company_id')
          .eq('user_id', targetEmployeeId)
          .single()
        
        if (empByUserIdError || !employeeByUserId) {
          console.error('❌ No employee record found for ID or user_id:', targetEmployeeId)
          return res.status(404).json({ error: 'Employee not found' })
        }
        
        targetEmployeeId = employeeByUserId.id
        console.log('✅ Found employee by user_id, using employee ID:', targetEmployeeId)
      } else {
        console.log('✅ Found employee record with provided ID:', targetEmployeeId)
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

    // Get employee details including joining date
    console.log('🔍 Fetching employee details for employee ID:', targetEmployeeId)
    const { data: employeeDetails, error: empDetailsError } = await supabaseAdmin
      .from('employees')
      .select('id, joining_date, leave_balance, full_name, email')
      .eq('id', targetEmployeeId)
      .single()

    if (empDetailsError || !employeeDetails) {
      console.error('❌ Error fetching employee details:', empDetailsError)
      console.error('❌ Target employee ID:', targetEmployeeId)
      console.error('❌ Current user:', currentUser.id)
      return res.status(500).json({ 
        error: 'Failed to fetch employee details', 
        details: empDetailsError?.message || 'Employee not found',
        targetEmployeeId,
        currentUserId: currentUser.id
      })
    }

    console.log('✅ Employee details fetched:', {
      id: employeeDetails.id,
      name: employeeDetails.full_name,
      email: employeeDetails.email,
      joiningDate: employeeDetails.joining_date,
      leaveBalance: employeeDetails.leave_balance
    })

    // Calculate the current leave year based on joining date
    let joiningDate
    
    if (!employeeDetails.joining_date) {
      console.warn('⚠️ Employee has no joining date, using current date as fallback:', employeeDetails)
      // Set joining date to current date as fallback
      joiningDate = new Date()
      
      // Update the employee record with a default joining date
      try {
        await supabaseAdmin
          .from('employees')
          .update({ joining_date: joiningDate.toISOString().split('T')[0] })
          .eq('id', employeeDetails.id)
        console.log('✅ Updated employee with default joining date')
      } catch (updateError) {
        console.warn('⚠️ Failed to update employee with default joining date:', updateError)
      }
    } else {
      joiningDate = new Date(employeeDetails.joining_date)
      
      // Validate joining date
      if (isNaN(joiningDate.getTime())) {
        console.warn('⚠️ Invalid joining date, using current date as fallback:', employeeDetails.joining_date)
        joiningDate = new Date()
        
        // Update the employee record with a corrected joining date
        try {
          await supabaseAdmin
            .from('employees')
            .update({ joining_date: joiningDate.toISOString().split('T')[0] })
            .eq('id', employeeDetails.id)
          console.log('✅ Updated employee with corrected joining date')
        } catch (updateError) {
          console.warn('⚠️ Failed to update employee with corrected joining date:', updateError)
        }
      }
    }

    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    
    // Calculate years since joining
    const yearsSinceJoining = currentYear - joiningDate.getFullYear()
    
    // If it's the first year, use joining date as start
    // If it's subsequent years, use January 1st of the current year
    let leaveYearStart
    if (yearsSinceJoining === 0) {
      // First year: start from joining date
      leaveYearStart = new Date(joiningDate)
    } else {
      // Subsequent years: start from January 1st of current year
      leaveYearStart = new Date(currentYear, 0, 1)
    }
    
    // Calculate leave year end (December 31st of current year)
    const leaveYearEnd = new Date(currentYear, 11, 31)
    
    console.log('🔍 Leave year calculation:', {
      joiningDate: joiningDate.toISOString(),
      currentDate: currentDate.toISOString(),
      yearsSinceJoining,
      leaveYearStart: leaveYearStart.toISOString(),
      leaveYearEnd: leaveYearEnd.toISOString()
    })

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
      
      // Automatic duplicate cleanup and deduplication
      if (leaveBalances.length > 0) {
        leaveBalances = await deduplicateLeaveBalances(leaveBalances, targetEmployeeId, currentYear)
        console.log('✅ Auto-cleaned and deduplicated leave balances:', leaveBalances.length)
      }
      
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
        const defaultBalances = leaveTypes.map(leaveType => {
          // Calculate pro-rated leave balance for first year based on joining date
          let totalDays
          if (leaveType.is_paid) {
            if (yearsSinceJoining === 0) {
              // First year: pro-rate based on joining date
              const daysInYear = 365
              const daysRemaining = Math.ceil((leaveYearEnd - leaveYearStart) / (1000 * 60 * 60 * 24))
              // Use employee's actual leave_balance from employees table, fallback to 10
              const employeeLeaveBalance = employeeDetails.leave_balance || 10
              totalDays = Math.ceil((employeeLeaveBalance * daysRemaining) / daysInYear)
            } else {
              // Subsequent years: use employee's actual leave_balance, fallback to 10
              totalDays = employeeDetails.leave_balance || 10
            }
          } else {
            // For unpaid leaves, use fixed allocation
            totalDays = leaveType.name === 'Personal Leave' ? 5 : 10
          }
          
          return {
            employee_id: targetEmployeeId,
            leave_type_id: leaveType.id,
            year: currentYear,
            total_days: totalDays,
            used_days: 0,
            remaining_days: totalDays
          }
        })
        
        // PERMANENT PREVENTION: Check for existing balances before inserting to prevent duplicates
        console.log('🔒 PERMANENT PREVENTION: Checking for existing balances before insertion...')
        const { data: existingBalances, error: existingError } = await supabaseAdmin
          .from('leave_balances')
          .select('leave_type_id')
          .eq('employee_id', targetEmployeeId)
          .eq('year', currentYear)
        
        if (existingError) {
          console.warn('⚠️ Could not check existing balances:', existingError)
        } else {
          // Filter out leave types that already have balances
          const existingLeaveTypeIds = existingBalances?.map(b => b.leave_type_id) || []
          const newBalances = defaultBalances.filter(balance => 
            !existingLeaveTypeIds.includes(balance.leave_type_id)
          )
          
          if (newBalances.length < defaultBalances.length) {
            console.log(`🔒 PERMANENT PREVENTION: Found ${existingLeaveTypeIds.length} existing balances, only creating ${newBalances.length} new ones`)
          }
          
          if (newBalances.length === 0) {
            console.log('✅ PERMANENT PREVENTION: All leave types already have balances, skipping insertion')
            // Fetch existing balances instead
            const { data: existingBalanceData, error: existingFetchError } = await supabaseAdmin
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
            
            if (existingFetchError) {
              console.error('❌ Error fetching existing balances:', existingFetchError)
              throw new Error('Failed to fetch existing balances')
            }
            
            leaveBalances = existingBalanceData || []
            console.log('✅ PERMANENT PREVENTION: Using existing balances:', leaveBalances.length)
            return res.json({ balances: leaveBalances })
          }
          
          defaultBalances = newBalances
        }
        
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
        // Get approved leave requests for this type in current leave year
        const { data: usedLeaves, error: usedError } = await supabaseAdmin
          .from('leave_requests')
          .select('total_days')
          .eq('employee_id', targetEmployeeId)
          .eq('leave_type_id', leaveType.id)
          .eq('status', 'approved_by_hr')
          .gte('start_date', leaveYearStart.toISOString().split('T')[0])
          .lte('end_date', leaveYearEnd.toISOString().split('T')[0])

        if (usedError) {
          console.error(`Error fetching used leaves for ${leaveType.name}:`, usedError)
          continue
        }

        const usedDays = usedLeaves?.reduce((sum, leave) => sum + (leave.total_days || 0), 0) || 0
        
        // Calculate total days based on leave type and year
        let totalDays, remainingDays
        
        if (leaveType.is_paid) {
          if (yearsSinceJoining === 0) {
            // First year: pro-rate based on joining date
            const daysInYear = 365
            const daysRemaining = Math.ceil((leaveYearEnd - leaveYearStart) / (1000 * 60 * 60 * 24))
            // Use employee's actual leave_balance from employees table, fallback to 10
            const employeeLeaveBalance = employeeDetails.leave_balance || 10
            totalDays = Math.ceil((employeeLeaveBalance * daysRemaining) / daysInYear)
          } else {
            // Subsequent years: use employee's actual leave_balance, fallback to 10
            totalDays = employeeDetails.leave_balance || 10
          }
          remainingDays = Math.max(0, totalDays - usedDays)
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
      
      // Deduplication for fallback calculations
      if (leaveBalances.length > 0) {
        leaveBalances = await deduplicateLeaveBalances(leaveBalances, targetEmployeeId, currentYear)
        console.log('✅ Auto-deduplicated fallback balances:', leaveBalances.length)
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
          // Get employee's leave balance from employees table
          const { data: employeeData, error: empError } = await supabaseAdmin
            .from('employees')
            .select('leave_balance')
            .eq('id', updatedRequest.employee_id)
            .single()
          
          const employeeLeaveBalance = employeeData?.leave_balance || 10
          
          const { error: createError } = await supabaseAdmin
            .from('leave_balances')
            .insert({
              employee_id: updatedRequest.employee_id,
              leave_type_id: updatedRequest.leave_type_id,
              year: currentYear,
              total_days: updatedRequest.leave_types?.is_paid ? employeeLeaveBalance : (updatedRequest.leave_types?.name === 'Personal Leave' ? 5 : 10),
              used_days: updatedRequest.total_days,
              remaining_days: Math.max(0, (updatedRequest.leave_types?.is_paid ? employeeLeaveBalance : (updatedRequest.leave_types?.name === 'Personal Leave' ? 5 : 10)) - updatedRequest.total_days)
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
        
        // If this is an unpaid leave, trigger salary recalculation for the affected month
        if (updatedRequest.leave_types?.is_paid === false) {
          try {
            console.log('💰 Unpaid leave approved, triggering salary recalculation...')
            
            // Get the month and year from the leave request
            const leaveStartDate = new Date(updatedRequest.start_date)
            const leaveMonth = leaveStartDate.getMonth() + 1 // JavaScript months are 0-indexed
            const leaveYear = leaveStartDate.getFullYear()
            
            console.log('📅 Leave affects salary for month:', leaveMonth, 'year:', leaveYear)
            
            // Check if salary slip already exists for this month
            const { data: existingSalarySlip, error: slipCheckError } = await supabaseAdmin
              .from('salary_slips')
              .select('id, net_salary')
              .eq('employee_id', updatedRequest.employee_id)
              .eq('month', leaveMonth)
              .eq('year', leaveYear)
              .single()
            
            if (existingSalarySlip) {
              console.log('⚠️ Salary slip already exists for month', leaveMonth, 'year', leaveYear)
              console.log('💡 HR should regenerate salary slip to include unpaid leave deduction')
            } else {
              console.log('✅ No salary slip exists yet, unpaid leave will be included in next salary generation')
            }
            
          } catch (salaryError) {
            console.error('❌ Error checking salary slip status:', salaryError)
            // Don't fail the leave approval if salary check fails
          }
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

// Reset leave balances for new year (called automatically or manually)
const resetLeaveBalancesForNewYear = async (req, res) => {
  try {
    const currentUser = req.user
    const { year } = req.params || { year: new Date().getFullYear() }
    
    // Check if user has permission
    if (!['admin', 'hr_manager'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied. Only Admin and HR Manager can reset leave balances.' })
    }

    console.log(`🔄 Resetting leave balances for year: ${year}`)

    // Get all employees in the company
    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, joining_date, leave_balance')
      .eq('company_id', currentUser.company_id)
      .eq('is_active', true)

    if (empError) {
      console.error('❌ Error fetching employees:', empError)
      return res.status(500).json({ error: 'Failed to fetch employees' })
    }

    // Get all leave types
    const { data: leaveTypes, error: typesError } = await supabaseAdmin
      .from('leave_types')
      .select('id, name, description, is_paid')
      .order('name')

    if (typesError) {
      console.error('❌ Error fetching leave types:', typesError)
      return res.status(500).json({ error: 'Failed to fetch leave types' })
    }

    let resetCount = 0
    let errorCount = 0

    // Reset balances for each employee
    for (const employee of employees) {
      try {
        const joiningDate = new Date(employee.joining_date)
        const employeeYear = joiningDate.getFullYear()
        
        // Calculate years since joining
        const yearsSinceJoining = year - employeeYear
        
        // If it's the first year, use joining date as start
        // If it's subsequent years, use January 1st of the current year
        let leaveYearStart
        if (yearsSinceJoining === 0) {
          // First year: start from joining date
          leaveYearStart = new Date(joiningDate)
        } else {
          // Subsequent years: start from January 1st of current year
          leaveYearStart = new Date(year, 0, 1)
        }
        
        // Calculate leave year end (December 31st of current year)
        const leaveYearEnd = new Date(year, 11, 31)
        
        // Delete existing balances for this year
        await supabaseAdmin
          .from('leave_balances')
          .delete()
          .eq('employee_id', employee.id)
          .eq('year', year)

        // Create new balances for each leave type
        const newBalances = leaveTypes.map(leaveType => {
          let totalDays
          if (leaveType.is_paid) {
            if (yearsSinceJoining === 0) {
              // First year: pro-rate based on joining date
              const daysInYear = 365
              const daysRemaining = Math.ceil((leaveYearEnd - leaveYearStart) / (1000 * 60 * 60 * 24))
              const employeeLeaveBalance = employee.leave_balance || 10
              totalDays = Math.ceil((employeeLeaveBalance * daysRemaining) / daysInYear)
            } else {
              // Subsequent years: use employee's actual leave_balance, fallback to 10
              totalDays = employee.leave_balance || 10
            }
          } else {
            // For unpaid leaves, use fixed allocation
            totalDays = leaveType.name === 'Personal Leave' ? 5 : 10
          }
          
          return {
            employee_id: employee.id,
            leave_type_id: leaveType.id,
            year: year,
            total_days: totalDays,
            used_days: 0,
            remaining_days: totalDays
          }
        })

        // Insert new balances
        const { error: insertError } = await supabaseAdmin
          .from('leave_balances')
          .insert(newBalances)

        if (insertError) {
          console.error(`❌ Error creating balances for employee ${employee.id}:`, insertError)
          errorCount++
        } else {
          resetCount++
        }
      } catch (employeeError) {
        console.error(`❌ Error processing employee ${employee.id}:`, employeeError)
        errorCount++
      }
    }

    console.log(`✅ Leave balance reset completed. Success: ${resetCount}, Errors: ${errorCount}`)

    res.json({ 
      message: 'Leave balances reset successfully',
      summary: {
        totalEmployees: employees.length,
        resetCount,
        errorCount,
        year
      }
    })

  } catch (error) {
    console.error('Reset leave balances error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Enhanced deduplication helper function with automatic cleanup
const deduplicateLeaveBalances = async (balances, employeeId, year) => {
  if (!balances || balances.length === 0) return []
  
  // Group by leave_type_id to find duplicates
  const groupedBalances = {}
  balances.forEach(balance => {
    if (!groupedBalances[balance.leave_type_id]) {
      groupedBalances[balance.leave_type_id] = []
    }
    groupedBalances[balance.leave_type_id].push(balance)
  })
  
  // Find duplicates and automatically clean them up
  let totalCleaned = 0
  for (const [leaveTypeId, balanceGroup] of Object.entries(groupedBalances)) {
    if (balanceGroup.length > 1) {
      console.log(`🧹 Auto-cleanup: Found ${balanceGroup.length} duplicate records for leave type ${leaveTypeId}`)
      
      // Sort by created_at to keep the oldest
      balanceGroup.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      
      // Keep the first (oldest) record, delete the rest
      const duplicatesToDelete = balanceGroup.slice(1).map(b => b.id)
      
      try {
        const { error: deleteError } = await supabaseAdmin
          .from('leave_balances')
          .delete()
          .in('id', duplicatesToDelete)
        
        if (deleteError) {
          console.warn('⚠️ Auto-cleanup failed for leave type:', leaveTypeId, deleteError)
        } else {
          totalCleaned += duplicatesToDelete.length
          console.log(`✅ Auto-cleanup: Deleted ${duplicatesToDelete.length} duplicate records for leave type ${leaveTypeId}`)
        }
      } catch (deleteError) {
        console.warn('⚠️ Auto-cleanup error for leave type:', leaveTypeId, deleteError)
      }
    }
  }
  
  if (totalCleaned > 0) {
    console.log(`🧹 Auto-cleanup completed: ${totalCleaned} duplicate records removed`)
    
    // Re-query to get clean data
    const { data: cleanBalanceData, error: cleanError } = await supabaseAdmin
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
      .eq('employee_id', employeeId)
      .eq('year', year)
    
    if (!cleanError && cleanBalanceData) {
      balances = cleanBalanceData
      console.log('✅ Auto-cleanup: Re-queried clean leave balances:', balances.length)
    }
  }
  
  // Return unique balances (first record of each leave type)
  const uniqueBalances = []
  const seenLeaveTypes = new Set()
  
  balances.forEach(balance => {
    if (!seenLeaveTypes.has(balance.leave_type_id)) {
      seenLeaveTypes.add(balance.leave_type_id)
      uniqueBalances.push(balance)
    }
  })
  
  console.log(`🔍 Auto-deduplication: ${balances.length} → ${uniqueBalances.length} unique balances`)
  return uniqueBalances
}

// Helper function to create missing employee record
const createMissingEmployeeRecord = async (userId, userData) => {
  try {
    console.log('🔧 Creating missing employee record for user:', userId)
    
    const { data: newEmployee, error: createError } = await supabaseAdmin
      .from('employees')
      .insert([{
        user_id: userId,
        full_name: userData.full_name || userData.email.split('@')[0],
        email: userData.email,
        company_id: userData.company_id,
        role: userData.role,
        is_active: true,
        joining_date: new Date().toISOString().split('T')[0], // Default to today
        leave_balance: 10 // Default leave balance
      }])
      .select('id, company_id, joining_date, leave_balance')
      .single()
    
    if (createError) {
      console.error('❌ Failed to create employee record:', createError)
      return { success: false, error: createError }
    }
    
    console.log('✅ Created missing employee record:', newEmployee)
    return { success: true, employee: newEmployee }
  } catch (error) {
    console.error('❌ Exception creating employee record:', error)
    return { success: false, error }
  }
}

module.exports = {
  getLeaveTypes,
  getLeaveBalance,
  createLeaveRequest,
  getLeaveRequests,
  updateLeaveRequest,
  getUnpaidLeaveDays,
  resetLeaveBalancesForNewYear
} 