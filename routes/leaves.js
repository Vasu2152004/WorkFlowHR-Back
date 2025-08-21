const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')
const {
  getLeaveTypes,
  getLeaveBalance,
  createLeaveRequest,
  getLeaveRequests,
  updateLeaveRequest,
  getUnpaidLeaveDays,
  resetLeaveBalancesForNewYear
} = require('../controllers/leaveController')

// Middleware to check if user is HR or Admin
const requireHR = (req, res, next) => {
  if (!['hr', 'hr_manager', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. HR role required.' })
  }
  next()
}

// Middleware to check if user is employee
const requireEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Access denied. Employee role required.' })
  }
  next()
}

// Get leave types (available to all authenticated users)
router.get('/types', authenticateToken, getLeaveTypes)

// Get leave balance for current user (no employee_id required)
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Get employee record for current user
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', currentUser.id)
      .single();

    if (error || !employee) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    // Call the existing getLeaveBalance function with the employee ID
    req.params.employee_id = employee.id;
    return getLeaveBalance(req, res);
  } catch (error) {
    console.error('❌ Get current user leave balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leave balance for specific employee
router.get('/balance/:employee_id', authenticateToken, getLeaveBalance)

// Add leave balance for specific employee (HR only)
router.post('/balance/:employee_id', authenticateToken, requireHR, async (req, res) => {
  try {
    const { employee_id } = req.params
    const { leave_type_id, total_days, used_days = 0 } = req.body
    const currentUser = req.user
    
    // Declare variables at function scope so they're accessible throughout
    let actualEmployeeId
    let actualLeaveTypeId
    
    console.log('🔍 Adding leave balance:', {
      employee_id,
      leave_type_id,
      total_days,
      used_days,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        company_id: currentUser.company_id
      }
    })

    // Validate required fields
    if (!leave_type_id || !total_days) {
      return res.status(400).json({ error: 'leave_type_id and total_days are required' })
    }

    // Check if the employee exists and get the UUID
    try {
      const { data: employeeData, error: employeeError } = await supabaseAdmin
        .from('employees')
        .select('id, full_name')
        .eq('id', employee_id)
        .single()
      
      if (employeeError || !employeeData) {
        console.error('❌ Employee not found:', employeeError)
        return res.status(404).json({ 
          error: 'Employee not found',
          details: 'The specified employee does not exist in the system'
        })
      }
      console.log('✅ Employee found:', employeeData.full_name, 'with UUID:', employeeData.id)
      
      // Store the actual UUID from the database
      actualEmployeeId = employeeData.id
    } catch (employeeError) {
      console.error('❌ Error checking employee:', employeeError)
      return res.status(500).json({ 
        error: 'Failed to verify employee',
        details: employeeError.message 
      })
    }

    // Check if the leave type exists and get the UUID
    try {
      const { data: leaveTypeData, error: leaveTypeError } = await supabaseAdmin
        .from('leave_types')
        .select('id, name')
        .eq('id', leave_type_id)
        .single()
      
      if (leaveTypeError || !leaveTypeData) {
        console.error('❌ Leave type not found:', leaveTypeError)
        return res.status(404).json({ 
          error: 'Leave type not found',
          details: 'The specified leave type does not exist in the system'
        })
      }
      console.log('✅ Leave type found:', leaveTypeData.name, 'with UUID:', leaveTypeData.id)
      
      // Store the actual UUID from the database
      actualLeaveTypeId = leaveTypeData.id
    } catch (leaveTypeError) {
      console.error('❌ Error checking leave type:', leaveTypeError)
      return res.status(500).json({ 
        error: 'Failed to verify leave type',
        details: leaveTypeError.message 
      })
    }

    // Verify that we have the required UUIDs
    if (!actualEmployeeId || !actualLeaveTypeId) {
      console.error('❌ Missing required UUIDs:', { actualEmployeeId, actualLeaveTypeId })
      return res.status(500).json({ 
        error: 'Failed to get required data',
        details: 'Could not retrieve employee or leave type information'
      })
    }

    console.log('✅ UUIDs retrieved successfully:', { actualEmployeeId, actualLeaveTypeId })

    // First, let's check if the leave_balances table exists and test the connection
    try {
      console.log('🔍 Testing database connection to leave_balances table...')
      const { data: testData, error: testError } = await supabaseAdmin
        .from('leave_balances')
        .select('id')
        .limit(1)
      
      if (testError) {
        console.error('❌ Database connection test failed:', testError)
        console.error('❌ Test error details:', {
          code: testError.code,
          message: testError.message,
          details: testError.details,
          hint: testError.hint
        })
        
        // Check if it's a table not found error
        if (testError.code === '42P01') {
          return res.status(500).json({ 
            error: 'leave_balances table does not exist in the database',
            details: 'Please ensure the database schema is properly set up'
          })
        }
        
        // Check if it's a permission error
        if (testError.code === '42501') {
          return res.status(500).json({ 
            error: 'Database permission denied',
            details: 'The database user does not have permission to access the leave_balances table'
          })
        }
        
        return res.status(500).json({ 
          error: 'Database connection failed',
          details: testError.message 
        })
      }
      console.log('✅ Database connection test successful')
      
      // Let's also check the table structure by trying to get column info
      try {
        const { data: structureData, error: structureError } = await supabaseAdmin
          .from('leave_balances')
          .select('*')
          .limit(0)
        
        if (structureError) {
          console.warn('⚠️ Could not get table structure:', structureError.message)
        } else {
          console.log('✅ Table structure check successful')
        }
        
        // Also try to get a sample record to verify read permissions
        try {
          const { data: sampleData, error: sampleError } = await supabaseAdmin
            .from('leave_balances')
            .select('id, employee_id, leave_type_id, year, total_days, used_days, remaining_days')
            .limit(1)
          
          if (sampleError) {
            console.warn('⚠️ Could not read sample data:', sampleError.message)
          } else {
            console.log('✅ Read permissions test successful, sample data available:', sampleData ? sampleData.length : 0, 'records')
          }
        } catch (sampleError) {
          console.warn('⚠️ Read permissions test failed:', sampleError.message)
        }
      } catch (structureError) {
        console.warn('⚠️ Table structure check failed:', structureError.message)
      }
    } catch (testError) {
      console.error('❌ Database connection test exception:', testError)
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: testError.message 
      })
    }

    // Get current year
    const currentYear = new Date().getFullYear()

    // Check if leave balance already exists for this employee, leave type, and year
    console.log('🔍 Checking for existing leave balance...')
    const { data: existingBalances, error: checkError } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('employee_id', actualEmployeeId) // Use the actual UUID
      .eq('leave_type_id', actualLeaveTypeId) // Use the actual UUID
      .eq('year', currentYear)

    if (checkError) {
      console.error('❌ Error checking existing leave balance:', checkError)
      console.error('❌ Check error details:', {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint
      })
      
      // Check if it's a permission error
      if (checkError.code === '42501') {
        return res.status(500).json({ 
          error: 'Database permission denied',
          details: 'The database user does not have permission to read from the leave_balances table'
        })
      }
      
      return res.status(500).json({ error: 'Failed to check existing leave balance' })
    }

    // Check if we have an existing leave balance for this employee, leave type, and year
    if (existingBalances && existingBalances.length > 0) {
      console.log('⚠️ Found existing leave balance, will update instead of create')
      
      // Find the existing balance to update
      const existingBalance = existingBalances[0] // Take the first one
      console.log('✅ Will update existing balance:', existingBalance.id)
      
      // Update the existing balance - the trigger will calculate remaining_days automatically
      const updatedBalance = {
        total_days: parseInt(total_days),
        used_days: parseInt(used_days),
        updated_at: new Date().toISOString()
        // Note: remaining_days is calculated automatically by the database trigger
      }

      console.log('🔍 Updating existing leave balance with:', updatedBalance)

      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('leave_balances')
        .update(updatedBalance)
        .eq('id', existingBalance.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Error updating leave balance:', updateError)
        return res.status(500).json({ 
          error: 'Failed to update leave balance',
          details: updateError.message 
        })
      }

      console.log('✅ Leave balance updated successfully:', updatedData)

      return res.status(200).json({
        message: 'Leave balance updated successfully',
        leave_balance: updatedData,
        action: 'updated'
      })
    }
    
    console.log('✅ No existing leave balance found, proceeding to create new one')

    // Create new leave balance - the trigger will calculate remaining_days automatically
    const newBalance = {
      employee_id: actualEmployeeId, // Use the actual UUID from the database
      leave_type_id: actualLeaveTypeId, // Use the actual UUID from the database
      year: currentYear,
      total_days: parseInt(total_days),
      used_days: parseInt(used_days)
      // Note: remaining_days is calculated automatically by the database trigger
    }

    // Validate the data types and values
    console.log('🔍 Validating leave balance data:', newBalance)
    
    if (!newBalance.employee_id || !newBalance.leave_type_id || 
        isNaN(newBalance.total_days) || isNaN(newBalance.used_days)) {
      return res.status(400).json({ 
        error: 'Invalid data types in leave balance data',
        details: 'All required fields must be provided and numeric fields must be valid numbers'
      })
    }

    if (newBalance.total_days < 0 || newBalance.used_days < 0) {
      return res.status(400).json({ 
        error: 'Invalid values in leave balance data',
        details: 'Days values cannot be negative'
      })
    }

    if (newBalance.used_days > newBalance.total_days) {
      return res.status(400).json({ 
        error: 'Invalid leave balance data',
        details: 'Used days cannot exceed total days'
      })
    }

    console.log('🔍 Attempting to insert leave balance:', newBalance)

    // Try to insert the leave balance with a timeout
    console.log('🔍 Inserting leave balance into database...')
    const { data: createdBalance, error: createError } = await supabaseAdmin
      .from('leave_balances')
      .insert(newBalance)
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating leave balance:', createError)
      console.error('❌ Error details:', {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint
      })
      
      // Try to provide more specific error information
      if (createError.code === '23505') {
        return res.status(409).json({ 
          error: 'Leave balance already exists',
          details: 'A leave balance with these exact parameters already exists'
        })
      } else if (createError.code === '23503') {
        return res.status(400).json({ 
          error: 'Invalid foreign key reference',
          details: 'The employee_id or leave_type_id does not exist in the referenced table'
        })
      } else if (createError.code === '23514') {
        return res.status(400).json({ 
          error: 'Data validation failed',
          details: 'The data does not meet the table constraints'
        })
      }
      
      return res.status(500).json({ 
        error: 'Failed to create leave balance',
        details: createError.message 
      })
    }

    console.log('✅ Leave balance created successfully:', createdBalance)

    res.status(201).json({
      message: 'Leave balance added successfully',
      leave_balance: createdBalance
    })

  } catch (error) {
    console.error('❌ Add leave balance error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create leave request (employees and HR)
router.post('/requests', authenticateToken, createLeaveRequest)

// Update leave balance for specific employee (HR only)
router.put('/balance/:employee_id/:balance_id', authenticateToken, requireHR, async (req, res) => {
  try {
    const { employee_id, balance_id } = req.params
    const { total_days, used_days } = req.body
    const currentUser = req.user
    
    console.log('🔍 Updating leave balance:', {
      employee_id,
      balance_id,
      total_days,
      used_days,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        company_id: currentUser.company_id
      }
    })

    // Validate required fields
    if (total_days === undefined || used_days === undefined) {
      return res.status(400).json({ error: 'total_days and used_days are required' })
    }

    // Validate that used_days doesn't exceed total_days
    if (parseInt(used_days) > parseInt(total_days)) {
      return res.status(400).json({ error: 'used_days cannot exceed total_days' })
    }

    // Check if leave balance exists
    const { data: existingBalance, error: checkError } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('id', balance_id)
      .eq('employee_id', employee_id)
      .single()

    if (checkError) {
      console.error('❌ Error checking existing leave balance:', checkError)
      return res.status(404).json({ error: 'Leave balance not found' })
    }

    // Update leave balance
    const updatedBalance = {
      total_days: parseInt(total_days),
      used_days: parseInt(used_days),
      remaining_days: parseInt(total_days) - parseInt(used_days),
      updated_at: new Date().toISOString()
    }

    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('leave_balances')
      .update(updatedBalance)
      .eq('id', balance_id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating leave balance:', updateError)
      return res.status(500).json({ error: 'Failed to update leave balance' })
    }

    console.log('✅ Leave balance updated successfully:', updatedData)

    res.json({
      message: 'Leave balance updated successfully',
      leave_balance: updatedData
    })

  } catch (error) {
    console.error('❌ Update leave balance error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete leave balance for specific employee (HR only)
router.delete('/balance/:employee_id/:balance_id', authenticateToken, requireHR, async (req, res) => {
  try {
    const { employee_id, balance_id } = req.params
    const currentUser = req.user
    
    console.log('🔍 Deleting leave balance:', {
      employee_id,
      balance_id,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        company_id: currentUser.company_id
      }
    })

    // Check if leave balance exists
    const { data: existingBalance, error: checkError } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('id', balance_id)
      .eq('employee_id', employee_id)
      .single()

    if (checkError) {
      console.error('❌ Error checking existing leave balance:', checkError)
      return res.status(404).json({ error: 'Leave balance not found' })
    }

    // Delete leave balance
    const { error: deleteError } = await supabaseAdmin
      .from('leave_balances')
      .delete()
      .eq('id', balance_id)

    if (deleteError) {
      console.error('❌ Error deleting leave balance:', deleteError)
      return res.status(500).json({ error: 'Failed to delete leave balance' })
    }

    console.log('✅ Leave balance deleted successfully')

    res.json({
      message: 'Leave balance deleted successfully'
    })

  } catch (error) {
    console.error('❌ Delete leave balance error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get leave requests (employees see their own, HR sees all)
router.get('/requests', authenticateToken, getLeaveRequests)

// Update leave request status (HR only)
router.put('/requests/:id', authenticateToken, requireHR, updateLeaveRequest)

// Get unpaid leave days for salary calculation
router.get('/unpaid-days', authenticateToken, getUnpaidLeaveDays)

// Reset leave balances for new year (Admin/HR Manager only)
router.post('/reset-balances/:year', authenticateToken, requireHR, resetLeaveBalancesForNewYear)

// Clean up duplicate leave balance records for a specific employee
router.post('/cleanup-duplicates/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params
    const currentUser = req.user
    
    console.log('🧹 Manual cleanup requested for employee:', employeeId)
    
    // Get all leave balance records for this employee
    const { data: allBalances, error: fetchError } = await supabaseAdmin
      .from('leave_balances')
      .select('id, leave_type_id, year, created_at')
      .eq('employee_id', employeeId)
    
    if (fetchError) {
      console.error('❌ Error fetching balances for cleanup:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch balances for cleanup' })
    }
    
    if (!allBalances || allBalances.length === 0) {
      return res.json({ message: 'No leave balance records to clean up', cleaned: 0 })
    }
    
    // Group by leave_type_id and year to find duplicates
    const groupedBalances = {}
    allBalances.forEach(balance => {
      const key = `${balance.leave_type_id}-${balance.year}`
      if (!groupedBalances[key]) {
        groupedBalances[key] = []
      }
      groupedBalances[key].push(balance)
    })
    
    // Find and delete duplicates, keeping only the oldest record
    let totalCleaned = 0
    for (const [key, balances] of Object.entries(groupedBalances)) {
      if (balances.length > 1) {
        console.log(`🧹 Found ${balances.length} duplicate records for key ${key}`)
        
        // Sort by created_at to keep the oldest
        balances.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        
        // Keep the first (oldest) record, delete the rest
        const duplicatesToDelete = balances.slice(1).map(b => b.id)
        
        try {
          const { error: deleteError } = await supabaseAdmin
            .from('leave_balances')
            .delete()
            .in('id', duplicatesToDelete)
          
          if (deleteError) {
            console.warn('⚠️ Failed to delete duplicates:', deleteError)
          } else {
            totalCleaned += duplicatesToDelete.length
            console.log(`✅ Deleted ${duplicatesToDelete.length} duplicate records for key ${key}`)
          }
        } catch (deleteError) {
          console.warn('⚠️ Error deleting duplicates:', deleteError)
        }
      }
    }
    
    console.log(`✅ Manual cleanup completed. Total records cleaned: ${totalCleaned}`)
    res.json({ 
      message: 'Cleanup completed successfully', 
      cleaned: totalCleaned,
      totalRecords: allBalances.length
    })
    
  } catch (error) {
    console.error('Manual cleanup error:', error)
    res.status(500).json({ error: 'Cleanup failed', details: error.message })
  }
})

// Bulk cleanup ALL duplicate leave balance records across ALL employees
router.post('/bulk-cleanup-duplicates', authenticateToken, requireHR, async (req, res) => {
  try {
    console.log('🧹 BULK cleanup requested for ALL employees')
    
    // Get ALL leave balance records from the database
    const { data: allBalances, error: fetchError } = await supabaseAdmin
      .from('leave_balances')
      .select('id, employee_id, leave_type_id, year, created_at')
    
    if (fetchError) {
      console.error('❌ Error fetching all balances for bulk cleanup:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch balances for bulk cleanup' })
    }
    
    if (!allBalances || allBalances.length === 0) {
      return res.json({ message: 'No leave balance records found', cleaned: 0 })
    }
    
    console.log(`🔍 Found ${allBalances.length} total leave balance records`)
    
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
        console.log(`🧹 Found ${balances.length} duplicate records for key ${key}`)
        
        // Sort by created_at to keep the oldest
        balances.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        
        // Keep the first (oldest) record, delete the rest
        const duplicatesToDelete = balances.slice(1).map(b => b.id)
        
        try {
          const { error: deleteError } = await supabaseAdmin
            .from('leave_balances')
            .delete()
            .in('id', duplicatesToDelete)
          
          if (deleteError) {
            console.warn('⚠️ Failed to delete duplicates for key:', key, deleteError)
          } else {
            totalCleaned += duplicatesToDelete.length
            console.log(`✅ Deleted ${duplicatesToDelete.length} duplicate records for key ${key}`)
          }
        } catch (deleteError) {
          console.warn('⚠️ Error deleting duplicates for key:', key, deleteError)
        }
      }
    }
    
    console.log(`✅ BULK cleanup completed. Total groups with duplicates: ${totalGroups}, Total records cleaned: ${totalCleaned}`)
    res.json({ 
      message: 'Bulk cleanup completed successfully', 
      totalGroupsWithDuplicates: totalGroups,
      cleaned: totalCleaned,
      totalRecords: allBalances.length
    })
    
  } catch (error) {
    console.error('Bulk cleanup error:', error)
    res.status(500).json({ error: 'Bulk cleanup failed', details: error.message })
  }
})

module.exports = router 