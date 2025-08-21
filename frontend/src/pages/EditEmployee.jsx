import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Calendar, 
  DollarSign, 
  Save, 
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

export default function EditEmployee() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  
  // Simple test render to debug the issue
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    )
  }

  // Check if user has permission to edit employees
  if (!['admin', 'hr_manager', 'hr'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">Only Admin, HR Manager, and HR can edit employees.</p>
          <p className="text-sm text-gray-500 mb-4">Your role: {user.role}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // State variables
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    department: '',
    designation: '',
    salary: '',
    joining_date: '',
    phone_number: '',
    address: '',
    emergency_contact: '',
    pan_number: '',
    bank_account: '',
    leave_balance: '10'
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Leave balance management
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalances, setLeaveBalances] = useState([])
  const [loadingLeaveBalance, setLoadingLeaveBalance] = useState(false)
  const [newLeaveBalance, setNewLeaveBalance] = useState({
    leave_type_id: '',
    total_days: '',
    used_days: '0'
  })

  const departments = [
    'Engineering',
    'Marketing',
    'Sales',
    'Human Resources',
    'Finance',
    'Operations',
    'Customer Support',
    'Product Management',
    'Design',
    'Legal',
    'IT Support',
    'Research & Development'
  ]

  const designations = [
    'Software Engineer',
    'Senior Software Engineer',
    'Lead Engineer',
    'Engineering Manager',
    'Product Manager',
    'Marketing Manager',
    'Sales Representative',
    'HR Specialist',
    'HR Manager',
    'Financial Analyst',
    'Accountant',
    'Operations Manager',
    'Customer Support Specialist',
    'UI/UX Designer',
    'Legal Counsel',
    'IT Support Specialist',
    'Research Scientist',
    'Data Analyst',
    'Project Manager',
    'Business Analyst'
  ]

  // Fetch employee data on component mount
  useEffect(() => {
    console.log('🔍 useEffect triggered:', { id, userRole: user?.role })
    
    if (id && user && ['admin', 'hr_manager', 'hr'].includes(user.role)) {
      console.log('✅ Fetching employee data...')
      fetchEmployeeData()
    } else {
      console.log('⚠️ useEffect conditions not met:', { id: !!id, user: !!user, role: user?.role })
    }
  }, [id, user])

  // Fetch employee data
  const fetchEmployeeData = async () => {
    try {
      console.log('🔍 fetchEmployeeData called')
      setFetching(true)
      setError('')
      
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEE_BY_ID(id))
      
      if (response.status === 200) {
        const employeeData = response.data.employee || response.data
        
        if (!employeeData) {
          throw new Error('No employee data received')
        }
        
        setFormData({
          full_name: employeeData.full_name || '',
          email: employeeData.email || '',
          department: employeeData.department || '',
          designation: employeeData.designation || '',
          salary: employeeData.salary || '',
          joining_date: employeeData.joining_date || '',
          phone_number: employeeData.phone_number || '',
          address: employeeData.address || '',
          emergency_contact: employeeData.emergency_contact || '',
          pan_number: employeeData.pan_number || '',
          bank_account: employeeData.bank_account || '',
          leave_balance: employeeData.leave_balance || '10'
        })
        
        // Fetch leave types and balances after employee data is loaded
        console.log('🔍 Fetching leave types and balances...')
        fetchLeaveTypes()
        fetchLeaveBalances()
      } else {
        throw new Error(`Failed to fetch employee data: ${response.status}`)
      }
    } catch (error) {
      console.error('Error fetching employee data:', error)
      setError(`Failed to fetch employee data: ${error.message}`)
      toast.error(`Failed to fetch employee data: ${error.message}`)
    } finally {
      setFetching(false)
    }
  }

  // Fetch leave types
  const fetchLeaveTypes = async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.LEAVE_TYPES)
      if (response.status === 200) {
        const data = response.data || []
        // Ensure we always have an array
        setLeaveTypes(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching leave types:', error)
      // Set default leave types if API fails
      setLeaveTypes([
        { id: 'annual', name: 'Annual Leave' },
        { id: 'sick', name: 'Sick Leave' },
        { id: 'personal', name: 'Personal Leave' },
        { id: 'maternity', name: 'Maternity Leave' },
        { id: 'paternity', name: 'Paternity Leave' },
        { id: 'bereavement', name: 'Bereavement Leave' },
        { id: 'study', name: 'Study Leave' },
        { id: 'unpaid', name: 'Unpaid Leave' }
      ])
    }
  }

  // Fetch leave balances for the employee
  const fetchLeaveBalances = async () => {
    try {
      console.log('🔍 fetchLeaveBalances called from:', new Error().stack?.split('\n')[2]?.trim() || 'unknown')
      setLoadingLeaveBalance(true)
      const response = await apiService.get(`${API_ENDPOINTS.LEAVE_BALANCE}/${id}`)
      
      if (response.status === 200) {
        console.log('🔍 Response data structure:', response.data)
        
        // The backend returns { balances: [...] }
        const balances = response.data?.balances || response.data?.leave_balances || response.data || []
        
        // Ensure we always have an array and it's properly formatted
        const safeBalances = Array.isArray(balances) ? balances : []
        console.log('✅ Leave balances fetched successfully:', safeBalances.length, 'records')
        console.log('🔍 Balances data:', safeBalances)
        setLeaveBalances(safeBalances)
      } else {
        console.log('⚠️ Leave balances fetch returned status:', response.status)
        setLeaveBalances([])
      }
    } catch (error) {
      console.error('❌ Error fetching leave balances:', error)
      setLeaveBalances([])
    } finally {
      setLoadingLeaveBalance(false)
    }
  }

  // Add new leave balance
  const addLeaveBalance = async () => {
    console.log('🔍 addLeaveBalance function called')
    
    if (!newLeaveBalance.leave_type_id || !newLeaveBalance.total_days) {
      toast.error('Please fill in all required fields')
      return
    }

    // Prevent multiple submissions
    if (loadingLeaveBalance) {
      console.log('⚠️ Operation already in progress, blocking duplicate call')
      toast.error('Please wait, operation in progress...')
      return
    }

    try {
      console.log('🔍 Adding leave balance:', newLeaveBalance)
      console.log('🔍 Current loading state:', loadingLeaveBalance)
      setLoadingLeaveBalance(true)
      
      const requestData = {
        leave_type_id: newLeaveBalance.leave_type_id,
        total_days: parseInt(newLeaveBalance.total_days),
        used_days: parseInt(newLeaveBalance.used_days) || 0
      }
      
      console.log('🔍 Sending request to:', `${API_ENDPOINTS.LEAVE_BALANCE}/${id}`)
      console.log('🔍 Request data:', requestData)
      
      const response = await apiService.post(`${API_ENDPOINTS.LEAVE_BALANCE}/${id}`, requestData)

      console.log('🔍 Response received:', response.status, response.data)

      if (response.status === 200 || response.status === 201) {
        console.log('✅ Leave balance operation successful, response:', response.data)
        
        // Check if it was created or updated
        if (response.data?.action === 'updated') {
          toast.success('Leave balance updated successfully')
        } else {
          toast.success('Leave balance added successfully')
        }
        
        setNewLeaveBalance({ leave_type_id: '', total_days: '', used_days: '0' })
        
        // Refresh the list after successful operation
        console.log('✅ Leave balance operation completed, refreshing list...')
        console.log('🔍 About to call fetchLeaveBalances...')
        await fetchLeaveBalances()
        console.log('✅ fetchLeaveBalances completed')
      }
    } catch (error) {
      console.error('❌ Error adding leave balance:', error)
      console.error('❌ Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        toast.error('Leave balance already exists with these parameters')
      } else if (error.response?.status === 400) {
        toast.error(error.response.data?.error || 'Invalid data provided')
      } else if (error.response?.status === 404) {
        toast.error('Employee or leave type not found')
      } else {
        toast.error(error.response?.data?.error || 'Failed to add leave balance')
      }
    } finally {
      console.log('🔍 Setting loading state to false')
      setLoadingLeaveBalance(false)
    }
  }

  // Update leave balance
  const updateLeaveBalance = async (balanceId, updatedData) => {
    console.log('🔍 updateLeaveBalance function called with:', { balanceId, updatedData })
    console.log('🔍 Called from:', new Error().stack?.split('\n')[2]?.trim() || 'unknown')
    
    try {
      const response = await apiService.put(`${API_ENDPOINTS.LEAVE_BALANCE}/${id}/${balanceId}`, updatedData)
      
      if (response.status === 200) {
        toast.success('Leave balance updated successfully')
        setEditingLeaveBalance(null)
        fetchLeaveBalances()
      }
    } catch (error) {
      console.error('❌ Error updating leave balance:', error)
      toast.error('Failed to update leave balance')
    }
  }

  // Handle inline editing save
  const handleInlineEditSave = (balance) => {
    const totalDaysInput = document.querySelector(`input[data-balance-id="${balance.id}"]`)
    const usedDaysInput = document.querySelector(`input[data-balance-id="${balance.id}-used"]`)
    
    if (totalDaysInput && usedDaysInput) {
      const totalDays = parseInt(totalDaysInput.value)
      const usedDays = parseInt(usedDaysInput.value)
      
      if (isNaN(totalDays) || isNaN(usedDays)) {
        toast.error('Please enter valid numbers')
        return
      }
      
      if (usedDays > totalDays) {
        toast.error('Used days cannot be more than total days')
        return
      }
      
      updateLeaveBalance(balance.id, {
        total_days: totalDays,
        used_days: usedDays
      })
    }
  }

  // Delete leave balance
  const deleteLeaveBalance = async (balanceId) => {
    if (!window.confirm('Are you sure you want to delete this leave balance?')) {
      return
    }

    try {
      const response = await apiService.delete(`${API_ENDPOINTS.LEAVE_BALANCE}/${id}/${balanceId}`)
      
      if (response.status === 200) {
        toast.success('Leave balance deleted successfully')
        fetchLeaveBalances()
      }
    } catch (error) {
      console.error('Error deleting leave balance:', error)
      toast.error('Failed to delete leave balance')
    }
  }

  // Form handling
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const response = await apiService.put(API_ENDPOINTS.EMPLOYEE_BY_ID(id), formData)
      
      if (response.status === 200) {
        setSuccess('Employee updated successfully!')
        toast.success('Employee updated successfully!')
        
        // Redirect to employees page after a short delay
        setTimeout(() => {
          navigate('/employees')
        }, 1500)
      } else {
        setError(response.data?.error || 'Failed to update employee')
        toast.error(response.data?.error || 'Failed to update employee')
      }
    } catch (error) {
      console.error('Error updating employee:', error)
      
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('access_token')
        toast.error('Session expired. Please login again.')
        navigate('/login')
        return
      }
      
      // Handle validation errors
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.error || 'Validation failed. Please check your input.'
        const errorDetails = error.response.data?.details || []
        
        if (errorDetails.length > 0) {
          const detailedMessage = errorDetails.map(err => `${err.param}: ${err.msg}`).join(', ')
          setError(`Validation failed: ${detailedMessage}`)
          toast.error(`Validation failed: ${detailedMessage}`)
        } else {
          setError(errorMessage)
          toast.error(errorMessage)
        }
        return
      }
      
      setError(error.message || 'Failed to update employee')
      toast.error(error.message || 'Failed to update employee')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/employees')
  }

  // Show loading state while fetching data
  if (fetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Loading Employee Data</h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch the employee information...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if there's an error and no data
  if (error && !formData.full_name) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-800 mb-4">Failed to Load Employee Data</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={fetchEmployeeData}
                className="bg-red-100 text-red-800 px-6 py-3 rounded-md font-medium hover:bg-red-200"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/employees')}
                className="bg-gray-100 text-gray-800 px-6 py-3 rounded-md font-medium hover:bg-gray-200"
              >
                Back to Employees
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Safety check - ensure all arrays are actually arrays
  const safeLeaveTypes = Array.isArray(leaveTypes) ? leaveTypes : []
  const safeLeaveBalances = Array.isArray(leaveBalances) ? leaveBalances : []
  const safeDepartments = Array.isArray(departments) ? departments : []
  const safeDesignations = Array.isArray(designations) ? designations : []

  console.log('EditEmployee: About to render main component', {
    leaveTypes: safeLeaveTypes.length,
    leaveBalances: safeLeaveBalances.length,
    departments: safeDepartments.length,
    designations: safeDesignations.length
  })

  try {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={handleBack}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 mr-4"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Employee</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error Loading Employee Data</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <div className="flex space-x-3">
                      <button
                        onClick={fetchEmployeeData}
                        className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => navigate('/employees')}
                        className="bg-gray-100 text-gray-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
                      >
                        Back to Employees
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Edit Employee</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Update employee information and settings
              </p>
            </div>

            {/* Success/Error Messages */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800">{success}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-800">{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Required Information */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center mb-4">
                  <User className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Required Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="full_name" className="form-label">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="form-label">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <label htmlFor="department" className="form-label">
                      Department *
                    </label>
                    <select
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select department</option>
                      {safeDepartments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="designation" className="form-label">
                      Designation *
                    </label>
                    <select
                      id="designation"
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select designation</option>
                      {safeDesignations.map((designation) => (
                        <option key={designation} value={designation}>
                          {designation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="salary" className="form-label">
                      Annual Salary (₹) *
                    </label>
                    <input
                      type="number"
                      id="salary"
                      name="salary"
                      value={formData.salary}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      className="input-field"
                      placeholder="Enter annual salary"
                    />
                  </div>

                  <div>
                    <label htmlFor="joining_date" className="form-label">
                      Joining Date *
                    </label>
                    <input
                      type="date"
                      id="joining_date"
                      name="joining_date"
                      value={formData.joining_date}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-4">
                  <Mail className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone_number" className="form-label">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone_number"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label htmlFor="leave_balance" className="form-label">
                      Leave Balance (Days)
                    </label>
                    <input
                      type="number"
                      id="leave_balance"
                      name="leave_balance"
                      value={formData.leave_balance}
                      onChange={handleInputChange}
                      min="0"
                      max="365"
                      className="input-field"
                      placeholder="Enter leave balance"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Default: 10 days. This will be pro-rated based on joining date for the first year.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="emergency_contact" className="form-label">
                      Emergency Contact
                    </label>
                    <input
                      type="tel"
                      id="emergency_contact"
                      name="emergency_contact"
                      value={formData.emergency_contact}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter emergency contact"
                    />
                  </div>

                  <div>
                    <label htmlFor="pan_number" className="form-label">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      id="pan_number"
                      name="pan_number"
                      value={formData.pan_number}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter PAN number"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="address" className="form-label">
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="3"
                      className="input-field"
                      placeholder="Enter address"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="bank_account" className="form-label">
                      Bank Account Details
                    </label>
                    <textarea
                      id="bank_account"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleInputChange}
                      rows="3"
                      className="input-field"
                      placeholder="Enter bank account details"
                    />
                  </div>
                </div>
              </div>

              {/* Leave Balance Management Section */}
              <div className="card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Leave Balance Management</h3>
                    <p className="text-sm text-gray-600">Manage leave balances for different leave types</p>
                  </div>
                  <button
                    onClick={fetchLeaveBalances}
                    disabled={loadingLeaveBalance}
                    className="btn-secondary text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingLeaveBalance ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {/* Add New Leave Balance */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Leave Balance</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Leave Type *
                      </label>
                      <select
                        value={newLeaveBalance.leave_type_id}
                        onChange={(e) => setNewLeaveBalance(prev => ({ ...prev, leave_type_id: e.target.value }))}
                        className="input-field"
                      >
                        <option value="">Select leave type</option>
                        {safeLeaveTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Days *
                      </label>
                      <input
                        type="number"
                        value={newLeaveBalance.total_days}
                        onChange={(e) => setNewLeaveBalance(prev => ({ ...prev, total_days: e.target.value }))}
                        min="0"
                        className="input-field"
                        placeholder="Enter total days"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Used Days
                      </label>
                      <input
                        type="number"
                        value={newLeaveBalance.used_days}
                        onChange={(e) => setNewLeaveBalance(prev => ({ ...prev, used_days: e.target.value }))}
                        min="0"
                        className="input-field"
                        placeholder="Enter used days"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={addLeaveBalance}
                      className="btn-primary text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Leave Balance
                    </button>
                  </div>
                </div>

                {/* Current Leave Balances */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Current Leave Balances</h4>
                  {loadingLeaveBalance ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-gray-600">Loading leave balances...</span>
                    </div>
                  ) : safeLeaveBalances.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No leave balances configured yet.</p>
                      <p className="text-sm mt-1">Add leave balances using the form above.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Leave Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Total Days
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Used Days
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Remaining
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {safeLeaveBalances.map((balance) => (
                            <tr key={balance.id || balance.leave_type_id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {balance.leave_type_name || balance.name || 'Unknown Type'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {balance.total_days || balance.balance || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {balance.used_days || balance.used || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(balance.total_days || balance.balance || 0) - (balance.used_days || balance.used || 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                                                      <button
                                      onClick={() => deleteLeaveBalance(balance.id)}
                                      className="text-gray-600 hover:text-red-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      title="Delete leave balance"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Employee
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error rendering EditEmployee component:', error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600">Failed to render the Edit Employee page.</p>
          <p className="text-sm text-gray-500 mb-4">Please try again later or contact support.</p>
          <button
            onClick={() => navigate('/employees')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Employees
          </button>
        </div>
      </div>
    )
  }
}
