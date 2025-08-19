import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'

const LeaveRequest = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalance, setLeaveBalance] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    employee_id: ''
  })

  useEffect(() => {
    if (user) {
      fetchLeaveTypes()
      fetchLeaveBalance()
      fetchLeaveRequests()
      if (['hr', 'hr_manager', 'admin'].includes(user.role)) {
        fetchEmployees()
      }
    }
  }, [user])

  // Fetch leave balance when employee selection changes
  useEffect(() => {
    if (user && formData.employee_id) {
      fetchLeaveBalance()
    }
  }, [formData.employee_id])

  const fetchLeaveTypes = async () => {
    try {
      console.log('🔄 Fetching leave types...')
      const response = await apiService.get(API_ENDPOINTS.LEAVE_TYPES)
      
      if (response.status === 200) {
        const data = response.data
        setLeaveTypes(Array.isArray(data) ? data : [])
        console.log('✅ Leave types fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching leave types:', error)
      toast.error('Failed to fetch leave types')
      setLeaveTypes([])
    }
  }

  const fetchLeaveBalance = async () => {
    try {
      console.log('🔄 Fetching leave balance...')
      console.log('👤 User object:', user)
      
      // For HR users, they might be viewing someone else's balance
      // For regular employees, we need to find their employee record
      let employeeId = formData.employee_id
      
      if (!employeeId) {
        // If no specific employee selected, try to find the current user's employee record
        try {
          console.log('🔍 Finding employee record for user:', user.id)
          const employeeResponse = await apiService.get(`${API_ENDPOINTS.USERS}/employees/${user.id}`)
          
          if (employeeResponse.status === 200) {
            const employeeData = employeeResponse.data
            employeeId = employeeData.employee?.id || user.id
            console.log('✅ Found employee ID:', employeeId)
          } else {
            employeeId = user.id // Fallback to user ID
            console.log('⚠️ Using user ID as fallback:', employeeId)
          }
        } catch (empError) {
          console.warn('⚠️ Could not find employee record, using user ID:', empError)
          employeeId = user.id
        }
      }
      
      console.log('🆔 Using employee ID for balance:', employeeId)
      const response = await apiService.get(`${API_ENDPOINTS.LEAVE_BALANCE}/${employeeId}`)
      
      if (response.status === 200) {
        const data = response.data
        const balances = data.balances || []
        
        // Deduplicate by leave_type_id to prevent duplicate tiles
        const uniqueBalances = []
        const seenLeaveTypes = new Set()
        
        balances.forEach(balance => {
          if (!seenLeaveTypes.has(balance.leave_type_id)) {
            seenLeaveTypes.add(balance.leave_type_id)
            uniqueBalances.push(balance)
          } else {
            console.warn('⚠️ Duplicate leave type found:', balance.leave_type_name || balance.leave_type_id)
          }
        })
        
        console.log(`🔍 Deduplication: ${balances.length} → ${uniqueBalances.length} unique balances`)
        setLeaveBalance(uniqueBalances)
        console.log('✅ Leave balance fetched and deduplicated successfully:', uniqueBalances)
      }
    } catch (error) {
      console.error('❌ Error fetching leave balance:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      toast.error('Failed to fetch leave balance')
      setLeaveBalance([])
    }
  }

  const fetchLeaveRequests = async () => {
    try {
      console.log('🔄 Fetching leave requests...')
      const response = await apiService.get(API_ENDPOINTS.LEAVE_REQUESTS)
      
      if (response.status === 200) {
        const data = response.data
        setLeaveRequests(Array.isArray(data) ? data : [])
        console.log('✅ Leave requests fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching leave requests:', error)
      toast.error('Failed to fetch leave requests')
      setLeaveRequests([])
    }
  }

  const fetchEmployees = async () => {
    try {
      console.log('🔄 Fetching employees...')
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEES)

      if (response.status === 200) {
        const data = response.data
        setEmployees(Array.isArray(data) ? data : [])
        console.log('✅ Employees fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching employees:', error)
      toast.error('Failed to fetch employees')
      setEmployees([])
    }
  }

  // Create employee record for current user if it doesn't exist
  const ensureEmployeeRecord = async () => {
    try {
      console.log('🔍 Ensuring employee record exists for user:', user.id)
      console.log('👤 User details:', {
        id: user.id,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
        company_id: user.company_id
      })
      
      const response = await apiService.post('/users/create-employee-record')
      
      console.log('📊 Employee record creation response:', response)
      
      if (response.status === 200 || response.status === 201) {
        const data = response.data
        console.log('✅ Employee record ensured:', data)
        return true
      } else {
        console.error('❌ Employee record creation failed with status:', response.status)
        console.error('❌ Response data:', response.data)
        throw new Error('Failed to ensure employee record')
      }
    } catch (error) {
      console.error('❌ Error ensuring employee record:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      return false
    }
  }

  // Test function to manually create employee record
  const testEmployeeRecordCreation = async () => {
    try {
      console.log('🧪 Testing employee record creation...')
      const result = await ensureEmployeeRecord()
      if (result) {
        toast.success('Employee record created successfully!')
      } else {
        toast.error('Employee record creation failed!')
      }
    } catch (error) {
      console.error('❌ Test failed:', error)
      toast.error('Test failed: ' + error.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason) {
        throw new Error('Please fill in all required fields')
      }

      // Validate dates
      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (startDate < today) {
        throw new Error('Start date cannot be in the past')
      }

      if (endDate < startDate) {
        throw new Error('End date cannot be before start date')
      }

      console.log('📤 Submitting leave request with data:', formData)
      console.log('👤 Current user:', {
        id: user.id,
        role: user.role,
        email: user.email,
        full_name: user.full_name
      })
      
      // Ensure employee record exists before creating leave request
      if (!['hr', 'hr_manager', 'admin'].includes(user.role)) {
        console.log('👤 Regular employee - ensuring employee record exists')
        const employeeRecordCreated = await ensureEmployeeRecord()
        if (!employeeRecordCreated) {
          throw new Error('Failed to create employee record. Please contact HR.')
        }
        
        // Add a small delay to ensure the database is updated
        console.log('⏳ Waiting for database update...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log('✅ Database update wait completed')
      }
      
      // For HR users, employee_id is required
      // For regular employees, employee_id should be empty (they create for themselves)
      const requestData = { ...formData }
      if (!['hr', 'hr_manager', 'admin'].includes(user.role)) {
        delete requestData.employee_id // Regular employees don't specify employee_id
        console.log('👤 Regular employee - will create leave request for themselves')
      } else {
        console.log('👤 HR user - creating leave request for employee:', requestData.employee_id)
      }

      console.log('📤 Final request data:', requestData)
      
      const response = await apiService.post(API_ENDPOINTS.LEAVE_REQUESTS, requestData)

      if (response.status !== 201) { // 201 Created
        const errorData = response.data
        throw new Error(errorData.error || 'Failed to create leave request')
      }

      const data = response.data
      toast.success('Leave request submitted successfully!')
      
      // Reset form
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        employee_id: ''
      })

      // Refresh data
      fetchLeaveRequests()
      fetchLeaveBalance()
    } catch (error) {
      console.error('❌ Error creating leave request:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      toast.error(error.message || 'Failed to create leave request')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      approved_by_hr: { color: 'bg-green-100 text-green-800', text: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' }
    }
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', text: status }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.text}</span>
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getLeaveTypeName = (request) => {
    // First try to get from the joined leave_types data
    if (request.leave_types && request.leave_types.name) {
      return request.leave_types.name
    }
    
    // If no joined data, try to find the leave type from the leaveTypes state
    if (leaveTypes.length > 0) {
      const leaveType = leaveTypes.find(type => type.id === request.leave_type_id)
      if (leaveType) {
        return leaveType.name
      }
    }
    
    // Fallback mapping for common leave types
    const fallbackTypes = {
      '550e8400-e29b-41d4-a716-446655440001': 'Annual Leave',
      '550e8400-e29b-41d4-a716-446655440002': 'Sick Leave',
      '550e8400-e29b-41d4-a716-446655440003': 'Personal Leave'
    }
    
    if (fallbackTypes[request.leave_type_id]) {
      return fallbackTypes[request.leave_type_id]
    }
    
    // Final fallback to UUID if no name found
    return request.leave_type_id || 'Unknown Type'
  }

  if (!user) {
    return <div className="text-center py-8">Please log in to access this page.</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
        
        {/* Test button for debugging */}
        <button
          onClick={testEmployeeRecordCreation}
          className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 mr-2"
        >
          🧪 Test Employee Record
        </button>
        
        <button
          onClick={async () => {
            try {
              console.log('🧹 One-time cleanup triggered...')
              
              // Get the current employee ID
              let employeeId = formData.employee_id
              if (!employeeId) {
                // Try to find the current user's employee record
                try {
                  const employeeResponse = await apiService.get(`${API_ENDPOINTS.USERS}/employees/${user.id}`)
                  if (employeeResponse.status === 200) {
                    employeeId = employeeResponse.data.employee?.id || user.id
                  } else {
                    employeeId = user.id
                  }
                } catch (empError) {
                  employeeId = user.id
                }
              }
              
              // Call the cleanup endpoint
              const response = await apiService.post(API_ENDPOINTS.LEAVE_CLEANUP_DUPLICATES(employeeId))
              
              if (response.status === 200) {
                const result = response.data
                toast.success(`One-time cleanup completed! Removed ${result.cleaned} duplicate records.`)
                console.log('✅ One-time cleanup result:', result)
                
                // Refresh leave balance after cleanup
                setTimeout(() => {
                  fetchLeaveBalance()
                }, 1000)
              }
            } catch (error) {
              console.error('❌ One-time cleanup failed:', error)
              toast.error('One-time cleanup failed. Please try again.')
            }
          }}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          🧹 One-time Cleanup
        </button>
        
        <button
          onClick={() => {
            console.log('🔍 Current leave balance state:', leaveBalance)
            console.log('🔍 Total records:', leaveBalance.length)
            
            // Group by leave type name to see actual duplicates
            const groupedByName = leaveBalance.reduce((acc, b) => {
              const name = b.leave_type_name || 'Unknown'
              if (!acc[name]) acc[name] = []
              acc[name].push(b)
              return acc
            }, {})
            
            console.log('🔍 Grouped by leave type name:', groupedByName)
            
            // Show duplicate counts by name
            Object.entries(groupedByName).forEach(([name, records]) => {
              if (records.length > 1) {
                console.log(`⚠️ DUPLICATE: ${name} has ${records.length} records`)
                records.forEach((record, index) => {
                  console.log(`  ${index + 1}. ID: ${record.leave_type_id}, Total: ${record.total_days}, Used: ${record.used_days}`)
                })
              }
            })
            
            // Show unique leave type IDs
            const uniqueIds = [...new Set(leaveBalance.map(b => b.leave_type_id))]
            console.log('🔍 Unique leave type IDs:', uniqueIds.length)
            console.log('🔍 All leave type IDs:', uniqueIds)
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 ml-2"
        >
          📊 Debug Info
        </button>
        
        <button
          onClick={async () => {
            try {
              console.log('🧪 Testing API connection...')
              
              // Test health endpoint
              const healthResponse = await fetch('/health')
              console.log('🏥 Health check response:', healthResponse.status, healthResponse.statusText)
              
              if (healthResponse.ok) {
                const healthData = await healthResponse.json()
                console.log('✅ Health check data:', healthData)
              }
              
              // Test API endpoint
              const apiResponse = await fetch('/api/leaves/types')
              console.log('🔗 API test response:', apiResponse.status, apiResponse.statusText)
              
              if (apiResponse.ok) {
                const apiData = await apiResponse.json()
                console.log('✅ API test data:', apiData)
              } else {
                console.error('❌ API test failed:', apiResponse.status, apiResponse.statusText)
              }
              
              toast.success('API test completed. Check console for details.')
            } catch (error) {
              console.error('❌ API test error:', error)
              toast.error('API test failed. Check console for details.')
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ml-2"
        >
          🧪 Test API
        </button>
        
        {/* Bulk cleanup button for HR users */}
        {['hr', 'hr_manager', 'admin'].includes(user.role) && (
          <button
            onClick={async () => {
              try {
                if (!confirm('⚠️ This will clean up ALL duplicate leave balance records across ALL employees. This action cannot be undone. Continue?')) {
                  return
                }
                
                console.log('🧹 BULK cleanup triggered...')
                toast.loading('Performing bulk cleanup...', { duration: 0 })
                
                const response = await apiService.post(API_ENDPOINTS.LEAVE_BULK_CLEANUP)
                
                if (response.status === 200) {
                  const result = response.data
                  toast.dismiss()
                  toast.success(`BULK cleanup completed! Removed ${result.cleaned} duplicate records from ${result.totalGroupsWithDuplicates} groups.`)
                  console.log('✅ Bulk cleanup result:', result)
                  
                  // Refresh leave balance after cleanup
                  setTimeout(() => {
                    fetchLeaveBalance()
                  }, 2000)
                }
              } catch (error) {
                toast.dismiss()
                console.error('❌ Bulk cleanup failed:', error)
                toast.error('Bulk cleanup failed. Please try again.')
              }
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 ml-2"
          >
            🧹 BULK Cleanup (HR Only)
          </button>
        )}
      </div>
      
              {/* Leave Balance */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Leave Balance</h2>
            {leaveBalance.length > 0 && (
              <div className="text-sm text-gray-600 bg-yellow-50 px-3 py-2 rounded-md">
                <span className="font-medium">Records:</span> {leaveBalance.length} 
                {leaveBalance.length > 10 && (
                  <span className="text-red-600 ml-2">⚠️ High duplicate count detected!</span>
                )}
              </div>
            )}
          </div>
          
          {/* Permanent Solution Info */}
          {leaveBalance.length > 10 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Permanent Solution Activated</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>✅ <strong>Automatic prevention:</strong> New duplicates are automatically prevented</p>
                    <p>✅ <strong>Auto-cleanup:</strong> Existing duplicates are cleaned up automatically</p>
                    <p>✅ <strong>No HR intervention needed:</strong> System maintains itself</p>
                    <p className="mt-2">💡 <strong>Tip:</strong> Click "🧹 One-time Cleanup" to immediately clean up your current duplicates</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {leaveBalance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaveBalance.map((balance) => (
                <div key={balance.leave_type_id} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{balance.leave_type_name}</h3>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Total: {balance.total_days} days</p>
                    <p>Used: {balance.used_days} days</p>
                    <p className="font-semibold text-blue-600">Remaining: {balance.remaining_days} days</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No leave balance information available
            </div>
          )}
        </div>

      {/* New Leave Request Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Leave</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection (for HR users) */}
          {['hr', 'hr_manager', 'admin'].includes(user.role) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee
              </label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name} ({employee.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type
            </label>
            <select
              name="leave_type_id"
              value={formData.leave_type_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Leave Type</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Please provide a reason for your leave request..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      {/* Leave Requests History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Leave Requests</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaveRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getLeaveTypeName(request)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.total_days} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(request.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaveRequests.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No leave requests found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeaveRequest 