import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

const LeaveRequest = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalance, setLeaveBalance] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadingLeaveBalance, setLoadingLeaveBalance] = useState(true)
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
      const response = await apiService.get(API_ENDPOINTS.LEAVE_TYPES)
      
      if (response.status === 200) {
        const data = response.data
        setLeaveTypes(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      // Leave types are optional, don't show error
    }
  }

  const fetchLeaveBalance = async () => {
    try {
      setLoadingLeaveBalance(true)
      console.log('Fetching leave balance for user:', user.id)
      
      // Find employee record for the current user
      let employeeId = user.id
      
      try {
        const employeeResponse = await apiService.get(API_ENDPOINTS.EMPLOYEE_BY_ID(user.id))
        if (employeeResponse.status === 200) {
          employeeId = employeeResponse.data.id
          console.log('Found employee ID:', employeeId)
        }
      } catch (error) {
        console.log('Could not find employee record, using user ID as fallback')
      }
      
      console.log('Using employee ID for balance:', employeeId)
      
      // First, get all leave types to ensure we have complete coverage
      let allLeaveTypes = []
      try {
        const leaveTypesResponse = await apiService.get(API_ENDPOINTS.LEAVE_TYPES)
        if (leaveTypesResponse.status === 200) {
          allLeaveTypes = leaveTypesResponse.data || []
          console.log('All leave types:', allLeaveTypes)
        }
      } catch (error) {
        console.log('Could not fetch leave types, using defaults')
        allLeaveTypes = [
          { id: 'annual', name: 'Annual Leave' },
          { id: 'sick', name: 'Sick Leave' },
          { id: 'personal', name: 'Personal Leave' },
          { id: 'maternity', name: 'Maternity Leave' },
          { id: 'paternity', name: 'Paternity Leave' },
          { id: 'bereavement', name: 'Bereavement Leave' },
          { id: 'study', name: 'Study Leave' },
          { id: 'unpaid', name: 'Unpaid Leave' }
        ]
      }
      
      // Then get the actual leave balance
      let leaveBalances = []
      try {
        const response = await apiService.get(`${API_ENDPOINTS.LEAVE_BALANCE}/${employeeId}`)
        console.log('Leave balance response:', response)
        
        if (response.status === 200) {
          // The backend now returns { balances: [...] }
          leaveBalances = response.data.balances || response.data.leave_balances || response.data || []
          console.log('Leave balances from API:', leaveBalances)
        }
      } catch (error) {
        console.log('Could not fetch leave balance from API')
      }
      
      // Create a comprehensive leave balance array
      const comprehensiveBalance = allLeaveTypes.map(leaveType => {
        const existingBalance = leaveBalances.find(b => 
          b.leave_type_id === leaveType.id || 
          b.leave_type_name === leaveType.name ||
          b.name === leaveType.name ||
          b.leave_types?.name === leaveType.name
        )
        
        return {
          leave_type_id: leaveType.id,
          leave_type_name: leaveType.name,
          balance: existingBalance?.total_days || existingBalance?.balance || 0,
          used: existingBalance?.used_days || existingBalance?.used || 0,
          remaining: existingBalance?.remaining_days || ((existingBalance?.total_days || existingBalance?.balance || 0) - (existingBalance?.used_days || existingBalance?.used || 0))
        }
      })
      
      console.log('Comprehensive leave balance:', comprehensiveBalance)
      setLeaveBalance(comprehensiveBalance)
      
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      // Set comprehensive default balance if everything fails
      const defaultBalance = [
        { leave_type_id: 'annual', leave_type_name: 'Annual Leave', balance: 20, used: 0, remaining: 20 },
        { leave_type_id: 'sick', leave_type_name: 'Sick Leave', balance: 10, used: 0, remaining: 10 },
        { leave_type_id: 'personal', leave_type_name: 'Personal Leave', balance: 5, used: 0, remaining: 5 },
        { leave_type_id: 'maternity', leave_type_name: 'Maternity Leave', balance: 90, used: 0, remaining: 90 },
        { leave_type_id: 'paternity', leave_type_name: 'Paternity Leave', balance: 14, used: 0, remaining: 14 },
        { leave_type_id: 'bereavement', leave_type_name: 'Bereavement Leave', balance: 3, used: 0, remaining: 3 },
        { leave_type_id: 'study', leave_type_name: 'Study Leave', balance: 10, used: 0, remaining: 10 },
        { leave_type_id: 'unpaid', leave_type_name: 'Unpaid Leave', balance: 0, used: 0, remaining: 0 }
      ]
      setLeaveBalance(defaultBalance)
    } finally {
      setLoadingLeaveBalance(false)
    }
  }

  const fetchLeaveRequests = async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEE_LEAVE_REQUESTS)
      
      if (response.status === 200) {
        const data = response.data
        setLeaveRequests(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      // Leave requests are optional, don't show error
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEES)
      
      if (response.status === 200) {
        const data = response.data
        setEmployees(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      // Employees are optional, don't show error
    }
  }

  // Form validation
  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.leave_type_id) {
      newErrors.leave_type_id = 'Leave type is required'
    }
    
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required'
    }
    
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required'
    }
    
    if (!formData.reason) {
      newErrors.reason = 'Reason is required'
    }
    
    // For HR users, employee selection is required
    if (user.role !== 'employee' && !formData.employee_id) {
      newErrors.employee_id = 'Employee selection is required'
    }
    
    // Validate dates
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (startDate < today) {
        newErrors.start_date = 'Start date cannot be in the past'
      }
      
      if (endDate < startDate) {
        newErrors.end_date = 'End date cannot be before start date'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Calculate days between two dates
  const calculateDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays + 1 // Include both start and end dates
  }

  const ensureEmployeeRecord = async () => {
    try {
      const response = await apiService.post(API_ENDPOINTS.USERS + '/ensure-employee', {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email
      })
      
      if (response.status === 200) {
        return response.data
      }
    } catch (error) {
      // Employee record creation is optional, don't show error
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Form submitted with data:', formData)
    
    if (!validateForm()) {
      console.log('Form validation failed:', errors)
      return
    }
    
    setSubmitting(true)
    setErrors({})
    
    try {
      // Prepare request data
      const requestData = {
        employee_id: user.role === 'employee' ? user.id : formData.employee_id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        total_days: calculateDays(formData.start_date, formData.end_date)
      }
      
      console.log('Prepared request data:', requestData)
      
      // For regular employees, ensure they have an employee record
      if (user.role === 'employee') {
        console.log('Ensuring employee record exists...')
        await ensureEmployeeRecord()
      }
      
      // For HR users, create leave request for the selected employee
      if (user.role !== 'employee') {
        requestData.employee_id = formData.employee_id
      }
      
      console.log('Sending request to:', API_ENDPOINTS.LEAVE_REQUESTS)
      const response = await apiService.post(API_ENDPOINTS.LEAVE_REQUESTS, requestData)
      console.log('Response received:', response)
      
      if (response.status === 201 || response.status === 200) {
        toast.success('Leave request submitted successfully!')
        navigate('/leave-request')
      } else {
        toast.error('Failed to submit leave request')
      }
    } catch (error) {
      console.error('Error submitting leave request:', error)
      const errorMessage = error.response?.data?.error || 'Failed to submit leave request'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
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
        

        

        

        

        
        {/* Bulk cleanup button for HR users */}
        {['hr', 'hr_manager', 'admin'].includes(user.role) && (
          <button
            onClick={async () => {
              try {
                if (!confirm('⚠️ This will clean up ALL duplicate leave balance records across ALL employees. This action cannot be undone. Continue?')) {
                  return
                }
                

                toast.loading('Performing bulk cleanup...', { duration: 0 })
                
                const response = await apiService.post(API_ENDPOINTS.LEAVE_BULK_CLEANUP)
                
                if (response.status === 200) {
                  const result = response.data
                  toast.dismiss()
                  toast.success(`BULK cleanup completed! Removed ${result.cleaned} duplicate records from ${result.totalGroupsWithDuplicates} groups.`)

                  
                  // Refresh leave balance after cleanup
                  setTimeout(() => {
                    fetchLeaveBalance()
                  }, 2000)
                }
              } catch (error) {
                toast.dismiss()
                console.error('Bulk cleanup failed:', error)
                toast.error('Bulk cleanup failed. Please try again.')
              }
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 ml-2"
          >
            🧹 BULK Cleanup (HR Only)
          </button>
        )}
      </div>
      
      {/* Leave Balance Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Leave Balance</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchLeaveBalance}
              disabled={loadingLeaveBalance}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLeaveBalance ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
              <span className="font-medium">Total Leave Types:</span> {leaveBalance.length}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loadingLeaveBalance ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Loading leave balance...</span>
          </div>
        ) : leaveBalance.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No Leave Balance Found</p>
            <p className="text-gray-600 mb-4">Your leave balance hasn't been set up yet.</p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={fetchLeaveBalance}
                className="btn-secondary text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={() => toast.info('Contact your HR manager to set up your leave balance')}
                className="btn-primary text-sm"
              >
                Contact HR
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Box */}
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Total Leave Summary</h3>
                    <div className="mt-1 text-sm text-green-700">
                      <p>Total remaining leave days: <span className="font-bold text-lg">{leaveBalance.reduce((total, balance) => total + (balance.remaining || 0), 0)} days</span></p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {leaveBalance.reduce((total, balance) => total + (balance.remaining || 0), 0)}
                  </div>
                  <div className="text-xs text-green-600">Total Days</div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Leave Balance Information</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Your current leave balance for different leave types. Contact HR if you notice any discrepancies.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Leave Balance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaveBalance.map((balance) => {
                // Use the calculated remaining days from the backend or calculate it
                const remaining = balance.remaining || ((balance.balance || 0) - (balance.used || 0))
                const usagePercentage = balance.balance ? ((balance.used || 0) / balance.balance) * 100 : 0
                
                return (
                  <div key={balance.leave_type_id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {balance.leave_type_name || balance.name || 'Leave Type'}
                      </h3>
                      <div className={`w-3 h-3 rounded-full ${
                        remaining > 5 
                          ? 'bg-green-500' 
                          : remaining > 0 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                      }`}></div>
                    </div>
                    
                    {/* Usage Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Usage</span>
                        <span>{Math.round(usagePercentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            usagePercentage > 80 ? 'bg-red-500' : usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Days:</span>
                        <span className="font-semibold text-gray-900">{balance.balance || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Used Days:</span>
                        <span className="font-semibold text-red-600">{balance.used || 0}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Remaining:</span>
                          <span className={`text-lg font-bold ${
                            remaining > 5 ? 'text-green-600' : remaining > 0 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {remaining}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* New Leave Request Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Leave</h2>
        
        {/* Progress Indicator */}
        {submitting && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">Processing Leave Request</h4>
                <p className="text-sm text-blue-700">Please wait while we submit your request...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {Object.entries(errors).map(([field, error]) => (
                      <li key={field}>
                        <span className="font-medium">{field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection (for HR users) */}
          {['hr', 'hr_manager', 'admin'].includes(user.role) && (
            <div>
              <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
                Employee *
              </label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleInputChange}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name} - {employee.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label htmlFor="leave_type_id" className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type *
            </label>
            <select
              name="leave_type_id"
              value={formData.leave_type_id}
              onChange={handleInputChange}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                End Date *
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason *
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              required
              disabled={submitting}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
              placeholder="Please provide a reason for your leave request"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting Request...
              </>
            ) : (
              'Submit Leave Request'
            )}
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