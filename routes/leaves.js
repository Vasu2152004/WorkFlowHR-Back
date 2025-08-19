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

// Get leave balance for employee
router.get('/balance/:employee_id', authenticateToken, getLeaveBalance)

// Create leave request (employees and HR)
router.post('/requests', authenticateToken, createLeaveRequest)

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