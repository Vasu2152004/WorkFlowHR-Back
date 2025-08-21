import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { Calendar, User, Clock, FileText, CheckCircle, XCircle, Eye, Filter, RefreshCw } from 'lucide-react'

const LeaveManagement = () => {
  const { user } = useAuth()
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [resettingBalances, setResettingBalances] = useState(false)

  // Check authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access leave management.</p>
        </div>
      </div>
    )
  }

  // Check HR role access
  if (!['hr', 'hr_manager', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">HR role required to access leave management.</p>
        </div>
      </div>
    )
  }

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Fetching leave requests with status filter:', filterStatus)
      console.log('User info:', { id: user.id, role: user.role, company_id: user.company_id })
      
      const url = `${API_ENDPOINTS.LEAVE_REQUESTS}?status=${filterStatus}`
      console.log('API URL:', url)
      
      const response = await apiService.get(url)
      console.log('Leave requests response:', response)
      
      if (response.status === 200) {
        const data = response.data
        console.log('Leave requests data:', data)
        setLeaveRequests(Array.isArray(data) ? data : [])
      } else {
        console.error('Leave requests failed with status:', response.status)
        setError('Failed to fetch leave requests')
      }
    } catch (error) {
      console.error('Leave requests fetch error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      
      if (error.response?.status === 403) {
        setError('Access denied. You need HR permissions to view leave requests.')
      } else if (error.response?.status === 404) {
        setError('Leave requests endpoint not found.')
      } else if (error.response?.status === 500) {
        setError('Server error. Please try again later.')
      } else {
        setError('Failed to fetch leave requests. Please check your connection.')
      }
    } finally {
      setLoading(false)
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

  const handleApprove = async (requestId) => {
    await handleStatusUpdate(requestId, 'approved_by_hr')
  }

  const handleReject = async (requestId) => {
    await handleStatusUpdate(requestId, 'rejected')
  }

  const handleStatusUpdate = async (requestId, status) => {
    if (status === 'rejected' && !remarks.trim()) {
      toast.error('Please provide remarks when rejecting a leave request')
      return
    }

    setLoading(true)
    try {
      
              const response = await apiService.put(`${API_ENDPOINTS.LEAVE_REQUESTS}/${requestId}`, {
        status,
        hr_remarks: status === 'rejected' ? remarks.trim() : null
      })

      if (response.status === 200) {
        const data = response.data
        toast.success(data.message || 'Leave request updated successfully')
        
        // Reset form
        setSelectedRequest(null)
        setRemarks('')
        
        // Refresh data
        fetchLeaveRequests()
      } else {
        throw new Error(response.data?.error || 'Failed to update leave request')
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update leave request')
    } finally {
      setLoading(false)
    }
  }

  const handleResetLeaveBalances = async () => {
    if (resettingBalances) return

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    
    if (!confirm(`Are you sure you want to reset leave balances for ${nextYear}? This will reset all employees' leave balances to their default values.`)) {
      return
    }

    try {
      setResettingBalances(true)
      setError(null)
      
      const response = await apiService.post(API_ENDPOINTS.LEAVE_BALANCE_RESET(nextYear))
      
      if (response.status === 200) {
        toast.success(`Leave balances reset successfully for ${nextYear}`)
      } else {
        throw new Error(response.data?.error || 'Failed to reset leave balances')
      }
    } catch (error) {
      toast.error(error.message || 'Failed to reset leave balances')
    } finally {
      setResettingBalances(false)
    }
  }

  useEffect(() => {
    if (user) {
      // Fetch all data
      Promise.all([
        fetchLeaveRequests(),
        fetchEmployees(),
        fetchLeaveTypes()
      ]).finally(() => {
        setInitialLoading(false)
      })
    }
  }, [user])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Leave Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage employee leave requests and approvals</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetLeaveBalances}
                disabled={resettingBalances}
                className="btn-secondary flex items-center"
              >
                {resettingBalances ? (
                  <>
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Leave Balances
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setError(null)
                      fetchLeaveRequests()
                      fetchEmployees()
                      fetchLeaveTypes()
                    }}
                    className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Initial Loading State */}
        {initialLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading leave management data...</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!initialLoading && (
          <>
            {/* Filters and Controls */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved_by_hr">Approved by HR</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Employee</label>
                  <select
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Employees</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name || employee.email || 'Unknown Employee'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      fetchLeaveRequests()
                      fetchEmployees()
                      fetchLeaveTypes()
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>

            {/* Leave Requests Display */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Leave Requests</h3>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
                  </div>
                ) : leaveRequests.length > 0 ? (
                  <div className="space-y-4">
                    {leaveRequests.map((request) => (
                      <div key={request.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {request.employees?.full_name || 'Unknown Employee'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {request.leave_types?.name || 'Unknown Leave Type'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {request.start_date} to {request.end_date} ({request.total_days} days)
                            </p>
                            {request.reason && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <span className="font-medium">Reason:</span> {request.reason}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              request.status === 'approved_by_hr' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {request.status}
                            </span>
                            
                            {/* Action buttons for pending requests */}
                            {request.status === 'pending' && (
                              <div className="flex space-x-2 mt-3">
                                <button
                                  onClick={() => handleApprove(request.id)}
                                  disabled={loading}
                                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  {loading ? 'Approving...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => setSelectedRequest(request)}
                                  disabled={loading}
                                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No leave requests found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No leave requests match your current filters.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rejection Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Reject Leave Request</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Please provide a reason for rejection..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setSelectedRequest(null)
                    setRemarks('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}
                  disabled={!remarks.trim() || loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveManagement 