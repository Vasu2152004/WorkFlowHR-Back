import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Users, 
  Calendar, 
  FileText,
  Building,
  DollarSign,
  Bell,
  RefreshCw,
  Download,
  Eye,
  User,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const EmployeeDashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [employeeData, setEmployeeData] = useState(null)
  const [salarySlips, setSalarySlips] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [detailedLeaveBalances, setDetailedLeaveBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSlips, setLoadingSlips] = useState(false)
  const [loadingLeaveBalance, setLoadingLeaveBalance] = useState(false)
  const [showSalarySlipModal, setShowSalarySlipModal] = useState(false)
  const [selectedSalarySlip, setSelectedSalarySlip] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch employee data on component mount
  useEffect(() => {
    if (user) {
      fetchEmployeeData()
      fetchSalarySlips()
      fetchLeaveRequests()
      fetchLeaveBalance()
    }
  }, [user])

  // Simplified employee data fetching
  const fetchEmployeeData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try to fetch employee details first
      let employeeDetails = null
      try {
        const response = await apiService.get(API_ENDPOINTS.EMPLOYEE_BY_ID(user.id))
        if (response.status === 200) {
          employeeDetails = response.data
        }
      } catch (error) {
        console.log('Could not fetch employee details, using user data as fallback')
      }
      
      // Combine user data with employee data (if available)
      const combinedData = {
        ...user,
        ...employeeDetails,
        full_name: employeeDetails?.full_name || user.full_name || 'Employee',
        email: employeeDetails?.email || user.email || '',
        department: employeeDetails?.department || 'Not assigned',
        designation: employeeDetails?.designation || 'Not assigned',
        joining_date: employeeDetails?.joining_date || employeeDetails?.created_at || 'Not set',
        salary: employeeDetails?.salary || 'Not set',
        leave_balance: employeeDetails?.leave_balance || 20
      }
      
      setEmployeeData(combinedData)
      setError(null)
    } catch (error) {
      console.error('Error fetching employee data:', error)
      setError('Failed to fetch employee details')
      
      // Set fallback data
      const fallbackData = {
        ...user,
        full_name: user.full_name || 'Employee',
        email: user.email || '',
        department: 'Not assigned',
        designation: 'Not assigned',
        joining_date: 'Not set',
        salary: 'Not set',
        leave_balance: 20
      }
      setEmployeeData(fallbackData)
    } finally {
      setLoading(false)
    }
  }

  // Fetch salary slips for current employee
  const fetchSalarySlips = async () => {
    setLoadingSlips(true)
    try {
      const response = await apiService.get(API_ENDPOINTS.SALARY_SLIPS)
      
      if (response.status === 200) {
        const salarySlips = response.data.salarySlips || response.data || []
        setSalarySlips(salarySlips)
      } else {
        throw new Error(`Failed to fetch salary slips: ${response.status}`)
      }
    } catch (error) {
      console.error('Error fetching salary slips:', error)
      setSalarySlips([])
    } finally {
      setLoadingSlips(false)
    }
  }

  // Fetch leave requests for current employee
  const fetchLeaveRequests = async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.EMPLOYEE_LEAVE_REQUESTS)
      
      if (response.status === 200) {
        const leaveRequests = response.data || []
        setLeaveRequests(leaveRequests)
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      setLeaveRequests([])
    }
  }

  // Enhanced leave balance calculation with multiple fallback methods
  const fetchLeaveBalance = async () => {
    setLoadingLeaveBalance(true)
    try {
      // Method 1: Try to get leave balance from the dedicated endpoint
      try {
        const leaveResponse = await apiService.get(`${API_ENDPOINTS.LEAVE_BALANCE}/${user.id}`)
        if (leaveResponse.status === 200) {
          const leaveData = leaveResponse.data
          console.log('🔍 Leave balance response:', leaveData)
          
          // The backend returns { balances: [...] }
          if (leaveData.balances && Array.isArray(leaveData.balances)) {
            // Store detailed leave balances
            setDetailedLeaveBalances(leaveData.balances)
            
            // Calculate total leave balance from all leave types
            const totalBalance = leaveData.balances.reduce((total, balance) => {
              return total + (balance.remaining_days || 0)
            }, 0)
            
            console.log('✅ Calculated total leave balance:', totalBalance)
            console.log('✅ Detailed leave balances:', leaveData.balances)
            setEmployeeData(prev => ({
              ...prev,
              leave_balance: totalBalance
            }))
          } else if (leaveData.leave_balance !== undefined) {
            // Fallback to old format
            setEmployeeData(prev => ({
              ...prev,
              leave_balance: leaveData.leave_balance
            }))
          }
        }
      } catch (error) {
        console.log('⚠️ Leave balance endpoint failed, using fallback:', error.message)
        // Use fallback calculation
      }
      
      // Method 2: Calculate from leave requests
      try {
        const allLeaveResponse = await apiService.get(API_ENDPOINTS.EMPLOYEE_LEAVE_REQUESTS)
        if (allLeaveResponse.status === 200) {
          const leaveRequests = allLeaveResponse.data || []
          
          // Filter approved leaves
          const approvedLeaves = leaveRequests.filter(req => req.status === 'approved')
          
          // Calculate total days taken
          const totalDaysTaken = approvedLeaves.reduce((total, req) => {
            const days = req.total_days || 0
            return total + days
          }, 0)
          
          // Default leave balance (can be customized per company policy)
          const defaultLeaveBalance = 20 // 20 days per year
          const calculatedBalance = Math.max(0, defaultLeaveBalance - totalDaysTaken)
          
          setEmployeeData(prev => ({
            ...prev,
            leave_balance: calculatedBalance
          }))
        }
      } catch (error) {
        // Use employee data if available
      }
      
      // Method 3: Use employee data if available
      if (employeeData?.leave_balance !== undefined) {
        return
      }
      
      // Method 4: Set a reasonable default
      setEmployeeData(prev => ({
        ...prev,
        leave_balance: 20
      }))
    } catch (error) {
      // Set default values on error
      setEmployeeData(prev => ({
        ...prev,
        leave_balance: 20
      }))
    } finally {
      setLoadingLeaveBalance(false)
    }
  }

  const handleViewSalarySlip = (slipId) => {
    const slip = salarySlips.find(s => s.id === slipId);
    if (slip) {
      setSelectedSalarySlip(slip);
      setShowSalarySlipModal(true);
    } else {
      toast.error('Salary slip not found');
    }
  };

  const handleDownloadSalarySlip = async (slipId) => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        toast.error('Authentication token not found')
        return
      }

      const response = await apiService.get(`${API_ENDPOINTS.SALARY}/my-slips/${slipId}/download`, {
        responseType: 'text'
      })

      // Convert HTML to PDF using jsPDF
      const htmlContent = response.data
      
      // Create a temporary div to render the HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      document.body.appendChild(tempDiv)

      // Use html2canvas to convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.scrollHeight
      })

      // Remove temporary div
      document.body.removeChild(tempDiv)

      // Create PDF using jsPDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 295 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      // Add first page
      pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Save the PDF
      const filename = `salary_slip_${slipId}.pdf`
      pdf.save(filename)
      
      toast.success('Salary slip PDF generated and downloaded successfully!')
    } catch (error) {
      toast.error('Failed to download salary slip')
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN')
  }

  const stats = [
    {
      name: 'Leave Balance',
      value: employeeData?.leave_balance !== undefined ? `${employeeData.leave_balance} days` : 'Calculating...',
      icon: Calendar,
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      action: () => fetchLeaveBalance()
    },
    {
      name: 'Salary Slips',
      value: `${salarySlips.length} available`,
      icon: FileText,
      color: 'from-green-600 to-green-700',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      action: () => fetchSalarySlips()
    },
    {
      name: 'Leave Requests',
      value: `${leaveRequests.length} submitted`,
      icon: Calendar,
      color: 'from-purple-600 to-purple-700',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      action: () => fetchLeaveRequests()
    }
  ]

  // Authentication check
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600">Please login to view your dashboard.</p>
        </div>
      </div>
    )
  }

  // Loading state with timeout fallback
  if (loading && !employeeData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner h-12 w-12 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading employee dashboard...</p>
        </div>
      </div>
    )
  }

  // Fallback UI if data fails to load
  if (!employeeData && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Dashboard Data</h2>
          <p className="text-gray-600 mb-4">There was an issue loading your employee information.</p>
          <button
            onClick={() => {
              setLoading(true)
              fetchEmployeeData()
            }}
            className="btn-primary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Employee Dashboard</h1>
            <p className="text-blue-100 text-lg">
              Welcome back, {employeeData?.full_name || user?.full_name || 'Employee'}!
            </p>
            <p className="text-blue-200 text-sm mt-2">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} • {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => {
                setLoading(true)
                fetchEmployeeData()
                fetchLeaveBalance()
                fetchSalarySlips()
                fetchLeaveRequests()
                toast.success('Dashboard refreshed!')
              }}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 backdrop-blur-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.name} 
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 cursor-pointer group"
            onClick={stat.action}
            title={`Click to refresh ${stat.name.toLowerCase()}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {stat.name}
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <div className="loading-spinner h-8 w-8"></div>
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-r ${stat.color} shadow-lg group-hover:scale-110 transition-transform`}>
                <stat.icon className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to refresh
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/leave-request')}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 text-center group"
            >
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Request Leave
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Submit a new leave application
              </p>
            </button>

            <button
              onClick={() => navigate('/salary-slips')}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-300 dark:hover:border-green-600 hover:shadow-md transition-all duration-200 text-center group"
            >
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 mb-3 group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                View Salary Slips
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Access your monthly payslips
              </p>
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all duration-200 text-center group"
            >
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 mb-3 group-hover:scale-110 transition-transform">
                <User className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Update Profile
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Edit your personal information
              </p>
            </button>

            <button
              onClick={() => navigate('/leave-management')}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md transition-all duration-200 text-center group"
            >
              <div className="inline-flex p-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Leave History
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                View all your leave requests
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            Today's Tasks
          </h3>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-black dark:text-gray-400">No tasks assigned</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Tasks will appear here when assigned</p>
          </div>
        </div>

        {/* My Stats */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            My Stats
          </h3>
          <div className="space-y-4">
            {stats.map((stat) => (
              <div key={stat.name} className={`p-4 rounded-lg ${stat.bgColor}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black dark:text-gray-400">
                      {stat.name}
                    </p>
                    <p className="text-xl font-bold text-black dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
            Upcoming Events
          </h3>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-black dark:text-gray-400">No upcoming events</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Events will appear here when scheduled</p>
          </div>
        </div>
      </div>

      {/* Salary Slips */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                My Salary Slips
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Access and download your monthly salary slips
              </p>
            </div>
            <button
              onClick={fetchSalarySlips}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          {loadingSlips ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner h-8 w-8"></div>
            </div>
          ) : salarySlips.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No salary slips available
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Your salary slips will appear here once they are generated by HR.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {salarySlips.slice(0, 6).map((slip) => (
                <div key={slip.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center text-white font-semibold mr-3">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Salary Slip - {slip.month_name || slip.month}/{slip.year}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Generated on {slip.created_at ? formatDate(slip.created_at) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewSalarySlip(slip.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDownloadSalarySlip(slip.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500 dark:text-gray-400">Basic Salary</label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ₹{slip.basic_salary || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-500 dark:text-gray-400">Gross Salary</label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ₹{slip.gross_salary || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-500 dark:text-gray-400">Net Salary</label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ₹{slip.net_salary || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-500 dark:text-gray-400">Status</label>
                      <p className="font-medium text-gray-900 dark:text-white">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Generated
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {salarySlips.length > 6 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => navigate('/salary-slips')}
                    className="btn-secondary"
                  >
                    View All Salary Slips ({salarySlips.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Leave Requests */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                My Leave Requests
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track your leave applications and their status
              </p>
            </div>
            <button
              onClick={() => navigate('/leave-request')}
              className="btn-primary flex items-center"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Request Leave
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner h-8 w-8"></div>
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No leave requests yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                You haven't submitted any leave requests yet.
              </p>
              <button
                onClick={() => navigate('/leave-request')}
                className="btn-primary"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Submit First Leave Request
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center text-white font-semibold mr-3">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {request.leave_type || 'Leave Request'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {request.start_date && request.end_date 
                            ? `${formatDate(request.start_date)} - ${formatDate(request.end_date)}`
                            : 'Date not specified'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        request.status === 'approved' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : request.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {request.status?.charAt(0).toUpperCase() + request.status?.slice(1) || 'Pending'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-3 w-3 mr-2" />
                      <span>Duration: {request.total_days || 'N/A'} days</span>
                    </div>
                    {request.reason && (
                      <div className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                        <Bell className="h-3 w-3 mr-2 mt-0.5" />
                        <span className="line-clamp-2">{request.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {leaveRequests.length > 5 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => navigate('/leave-management')}
                    className="btn-secondary"
                  >
                    View All Leave Requests ({leaveRequests.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Employee Information */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                My Information
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your personal and employment details
              </p>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="btn-secondary flex items-center"
            >
              <User className="h-4 w-4 mr-2" />
              Edit Profile
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner h-8 w-8"></div>
            </div>
          ) : employeeData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{employeeData.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                  <p className="text-gray-900 dark:text-white">{employeeData.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                  <p className="text-gray-900 dark:text-white">{employeeData.department || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Designation</label>
                  <p className="text-gray-900 dark:text-white">{employeeData.designation || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee ID</label>
                  <p className="text-gray-900 dark:text-white">{employeeData.employee_id || 'Not assigned'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Joining Date</label>
                  <p className="text-gray-900 dark:text-white">
                    {employeeData.joining_date ? formatDate(employeeData.joining_date) : 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Leave Balance</label>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (employeeData.leave_balance || 0) > 10 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : (employeeData.leave_balance || 0) > 5
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {loadingLeaveBalance ? (
                        <div className="flex items-center space-x-1">
                          <div className="loading-spinner h-3 w-3"></div>
                          <span>Calculating...</span>
                        </div>
                      ) : (
                        `${employeeData.leave_balance !== undefined ? employeeData.leave_balance : 0} days`
                      )}
                    </span>
                    <button
                      onClick={fetchLeaveBalance}
                      disabled={loadingLeaveBalance}
                      className={`p-1 transition-colors ${
                        loadingLeaveBalance 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-gray-400 hover:text-blue-600'
                      }`}
                      title="Refresh leave balance"
                    >
                      {loadingLeaveBalance ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <p className="text-gray-900 dark:text-white">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Active
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Employee information not available
              </p>
              <button
                onClick={fetchEmployeeData}
                className="btn-secondary"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Salary Slip Detail Modal */}
      {showSalarySlipModal && selectedSalarySlip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-strong max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Salary Slip Details
                </h3>
                <button
                  onClick={() => {
                    setShowSalarySlipModal(false)
                    setSelectedSalarySlip(null)
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Employee Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                      <p className="text-gray-900 dark:text-white">{selectedSalarySlip.employee_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee ID</label>
                      <p className="text-gray-900 dark:text-white">{selectedSalarySlip.employee_id || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Month/Year</label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedSalarySlip.month_name || selectedSalarySlip.month}/{selectedSalarySlip.year}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Salary Summary</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Basic Salary</label>
                      <p className="text-gray-900 dark:text-white">₹{selectedSalarySlip.basic_salary || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Gross Salary</label>
                      <p className="text-gray-900 dark:text-white">₹{selectedSalarySlip.gross_salary || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Salary</label>
                      <p className="text-gray-900 dark:text-white">₹{selectedSalarySlip.net_salary || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => handleDownloadSalarySlip(selectedSalarySlip.id)}
                  className="btn-primary flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeDashboard
