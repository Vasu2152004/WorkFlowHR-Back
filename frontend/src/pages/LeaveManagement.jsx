import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { Calendar, User, Clock, FileText, CheckCircle, XCircle, Eye, Filter } from 'lucide-react'

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
      setError(null)
      console.log('🔄 Fetching leave requests...')
      
      let url = API_ENDPOINTS.LEAVE_REQUESTS
      const params = new URLSearchParams()
      
      if (filterStatus) {
        params.append('status', filterStatus)
      }
      if (filterEmployee) {
        params.append('employee_id', filterEmployee)
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      console.log('🌐 Fetching from URL:', url)
      const response = await apiService.get(url)
      
      if (response.status === 200) {
        const data = response.data
        setLeaveRequests(Array.isArray(data) ? data : [])
        console.log('✅ Leave requests fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching leave requests:', error)
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to fetch leave requests'
      setError(String(errorMessage))
      setLeaveRequests([])
      toast.error('Failed to fetch leave requests')
    }
  }

  const fetchEmployees = async () => {
    try {
      setError(null)
      console.log('🔄 Fetching employees...')
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEES)

      if (response.status === 200) {
        const data = response.data
        setEmployees(Array.isArray(data) ? data : [])
        console.log('✅ Employees fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching employees:', error)
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to fetch employees'
      setError(String(errorMessage))
      setEmployees([])
      toast.error('Failed to fetch employees')
    }
  }

  const fetchLeaveTypes = async () => {
    try {
      setError(null)
      console.log('🔄 Fetching leave types...')
      const response = await apiService.get(API_ENDPOINTS.LEAVE_TYPES)

      if (response.status === 200) {
        const data = response.data
        setLeaveTypes(Array.isArray(data) ? data : [])
        console.log('✅ Leave types fetched successfully:', Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('❌ Error fetching leave types:', error)
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to fetch leave types'
      setError(String(errorMessage))
      setLeaveTypes([])
      toast.error('Failed to fetch leave types')
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
      console.log('🔄 Updating leave request status:', { requestId, status })
      
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
      console.error('❌ Error updating leave request status:', error)
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
        console.log('✅ Leave balance reset response:', response.data)
      } else {
        throw new Error(response.data?.error || 'Failed to reset leave balances')
      }
    } catch (error) {
      console.error('❌ Error resetting leave balances:', error)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
              <p className="text-gray-600 mt-1">Manage employee leave requests and approvals</p>
            </div>
            {['hr_manager', 'admin'].includes(user.role) && (
              <button
                onClick={handleResetLeaveBalances}
                disabled={resettingBalances}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {resettingBalances ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Reset Leave Balances
                  </>
                )}
              </button>
            )}
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
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved_by_hr">Approved by HR</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Employee</label>
                  <select
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Leave Requests</h3>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading...</span>
                  </div>
                ) : leaveRequests.length > 0 ? (
                  <div className="space-y-4">
                    {leaveRequests.map((request) => (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {request.employees?.full_name || 'Unknown Employee'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {request.leave_types?.name || 'Unknown Leave Type'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {request.start_date} to {request.end_date} ({request.total_days} days)
                            </p>
                            {request.reason && (
                              <p className="text-sm text-gray-500 mt-1">
                                <span className="font-medium">Reason:</span> {request.reason}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'approved_by_hr' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
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
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests found</h3>
                    <p className="mt-1 text-sm text-gray-500">No leave requests match your current filters.</p>
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Leave Request</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please provide a reason for rejection..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setSelectedRequest(null)
                    setRemarks('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
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