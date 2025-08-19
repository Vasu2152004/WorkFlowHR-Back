import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { User, Mail, Building, Briefcase, DollarSign, Calendar, Phone, MapPin, FileText, ArrowLeft, Save, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'

export default function EditEmployee() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
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

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated || !user) {
      toast.error('Please login to edit employees')
      navigate('/login')
      return
    }

    // Check if user has permission to edit employees
    if (!['admin', 'hr_manager', 'hr'].includes(user.role)) {
      toast.error('Only Admin, HR Manager, and HR can edit employees')
      navigate('/dashboard')
      return
    }
  }, [isAuthenticated, user, navigate])

  // Fetch employee data on component mount
  useEffect(() => {
    if (id && isAuthenticated && user) {
      fetchEmployeeData()
    }
  }, [id, isAuthenticated, user])

  // If not authenticated, don't render the component
  if (!isAuthenticated || !user || !['admin', 'hr_manager', 'hr'].includes(user.role)) {
    return null
  }

  const fetchEmployeeData = async () => {
    try {
      setFetching(true)
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEE_BY_ID(id))
      
      if (response.status === 200) {
        const employeeData = response.data.employee
        setFormData({
          full_name: employeeData.full_name || '',
          email: employeeData.email || '',
          department: employeeData.department || '',
          designation: employeeData.designation || '',
          salary: employeeData.salary?.toString() || '',
          joining_date: employeeData.joining_date || '',
          phone_number: employeeData.phone_number || '',
          address: employeeData.address || '',
          emergency_contact: employeeData.emergency_contact || '',
          pan_number: employeeData.pan_number || '',
          bank_account: employeeData.bank_account || '',
          leave_balance: employeeData.leave_balance?.toString() || '10'
        })
      } else {
        toast.error('Failed to fetch employee data')
        navigate('/employees')
      }
    } catch (error) {
      console.error('Error fetching employee data:', error)
      toast.error('Failed to fetch employee data')
      navigate('/employees')
    } finally {
      setFetching(false)
    }
  }

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

      console.log('Submitting form data:', formData)
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

  if (fetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading employee data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
              <User className="h-8 w-8 text-blue-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900 dark:text-white">Edit Employee</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
                    {departments.map((department) => (
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
                    {designations.map((designation) => (
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
                <FileText className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-2" />
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

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
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
      </main>
    </div>
  )
}
