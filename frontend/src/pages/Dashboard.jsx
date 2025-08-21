import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, 
  Clock, 
  Calendar, 
  FileText,
  Building,
  DollarSign,
  Bell,
  Plus,
  RefreshCw,
  Edit
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import CalendarWidget from '../components/CalendarWidget'
import { apiService, API_ENDPOINTS } from '../config/api'

const Dashboard = () => {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    pendingLeaveRequests: 0,
    leaveRequests: 0,
    salarySlipsGenerated: 0,
    recentEmployees: [],
    companyInfo: null
  })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch employees first
      let employees = []
      let totalEmployees = 0
      let recentEmployees = []
      
      try {
        const employeesResponse = await apiService.get(API_ENDPOINTS.USERS + '/employees')
        if (employeesResponse.status === 200) {
          const employeesData = employeesResponse.data
          employees = employeesData.employees || []
          totalEmployees = employees.length
          
          // Get recent employees (last 5)
          recentEmployees = employees
            .sort((a, b) => new Date(b.created_at || b.joining_date || 0) - new Date(a.created_at || a.joining_date || 0))
            .slice(0, 5)
            .map(emp => ({
              id: emp.id,
              full_name: emp.full_name || emp.user?.full_name || 'Unknown',
              department: emp.department || 'N/A',
              designation: emp.designation || 'N/A',
              joining_date: emp.joining_date || emp.created_at || new Date().toISOString()
            }))
        }
      } catch (error) {
        console.error('Failed to fetch employees:', error)
        employees = []
        totalEmployees = 0
        recentEmployees = []
      }

      // Fetch pending leave requests
      let pendingLeaveRequests = 0
      try {
        const leaveResponse = await apiService.get(API_ENDPOINTS.LEAVE_REQUESTS + '?status=pending')
        if (leaveResponse.status === 200) {
          const leaveData = leaveResponse.data
          pendingLeaveRequests = Array.isArray(leaveData) ? leaveData.length : 0
        }
      } catch (error) {
        pendingLeaveRequests = 0
      }

      // Fetch total leave requests
      let totalLeaveRequests = 0
      try {
        const allLeaveResponse = await apiService.get(API_ENDPOINTS.LEAVE_REQUESTS)
        if (allLeaveResponse.status === 200) {
          const allLeaveData = allLeaveResponse.data
          totalLeaveRequests = Array.isArray(allLeaveData) ? allLeaveData.length : 0
        }
      } catch (error) {
        totalLeaveRequests = 0
      }

      // Fetch salary slips generated this month
      let salarySlipsGenerated = 0
      try {
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()
        const salaryResponse = await apiService.get(API_ENDPOINTS.SALARY + '/all')
        if (salaryResponse.status === 200) {
          const salaryData = salaryResponse.data
          const currentMonthSlips = (salaryData.salarySlips || []).filter(slip => 
            slip.month === currentMonth && slip.year === currentYear
          )
          salarySlipsGenerated = currentMonthSlips.length
        }
      } catch (error) {
        salarySlipsGenerated = 0
      }

      // Fetch company profile
      let companyInfo = null
      try {
        const companyResponse = await apiService.get(API_ENDPOINTS.USERS + '/company/profile')
        if (companyResponse.status === 200) {
          const companyData = companyResponse.data
          companyInfo = companyData.company
        }
      } catch (error) {
        companyInfo = null
      }

      // Set dashboard data
      setDashboardData({
        totalEmployees,
        pendingLeaveRequests,
        leaveRequests: totalLeaveRequests,
        salarySlipsGenerated,
        recentEmployees,
        companyInfo: companyInfo ? {
          name: companyInfo.name,
          established: companyInfo.founded_year || new Date().getFullYear(),
          employees: totalEmployees,
          location: companyInfo.address || 'Not specified'
        } : null
      })
      
    } catch (error) {
      console.error('Dashboard data fetch error:', error)
      toast.error('Failed to fetch dashboard data')
      
      // Set default values on error
      setDashboardData({
        totalEmployees: 0,
        pendingLeaveRequests: 0,
        leaveRequests: 0,
        salarySlipsGenerated: 0,
        recentEmployees: [],
        companyInfo: null
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const handleRefresh = () => {
    fetchDashboardData()
    toast.success('Dashboard refreshed!')
  }

  const stats = [
    {
      name: 'Total Employees',
      value: (dashboardData.totalEmployees || 0).toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: Users,
      color: 'from-blue-600 to-blue-700'
    },
    {
      name: 'Pending Leave Requests',
      value: (dashboardData.pendingLeaveRequests || 0).toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: Clock,
      color: 'from-amber-600 to-amber-700'
    },
    {
      name: 'Leave Requests',
      value: (dashboardData.leaveRequests || 0).toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: Calendar,
      color: 'from-emerald-600 to-emerald-700'
    },
    {
      name: 'Salary Slips Generated',
      value: (dashboardData.salarySlipsGenerated || 0).toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: FileText,
      color: 'from-cyan-600 to-cyan-700'
    }
  ]

  const quickActions = [
    {
      name: 'Add Employee',
      description: 'Create new employee profile',
      icon: Users,
      color: 'bg-gradient-to-r from-blue-600 to-blue-700',
      href: '/add-employee'
    },
    ...(user?.role === 'admin' ? [{
      name: 'Add HR Staff',
      description: 'Create HR and HR Manager accounts',
      icon: Users,
      color: 'bg-gradient-to-r from-purple-600 to-purple-700',
      href: '/add-hr-staff'
    }] : []),
    {
      name: 'Manage Leave',
      description: 'Review and approve leave requests',
      icon: Calendar,
      color: 'bg-gradient-to-r from-amber-600 to-amber-700',
      href: '/leave-management'
    },
    {
      name: 'Generate Documents',
      description: 'Create and generate HR documents',
      icon: FileText,
      color: 'bg-gradient-to-r from-green-600 to-green-700',
      href: '/generate-document'
    },
    {
      name: 'Salary Management',
      description: 'Manage employee salaries and slips',
      icon: DollarSign,
      color: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
      href: '/salary-slips'
    },
    {
      name: 'Company Calendar',
      description: 'Manage company events and holidays',
      icon: Calendar,
      color: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
      href: '/company-calendar'
    }
  ]

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">WorkFlowHR Dashboard</h1>
            <p className="text-blue-100 text-lg">
              Welcome to your Human Resource Management System
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
              onClick={handleRefresh}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 backdrop-blur-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
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
                <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
                  {stat.name === 'Total Employees' && 'Active team members'
                  || stat.name === 'Pending Leave Requests' && 'Awaiting approval'
                  || stat.name === 'Leave Requests' && 'Total requests this month'
                  || stat.name === 'Salary Slips Generated' && 'This month'
                  || 'Updated just now'}
                </p>
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-r ${stat.color} shadow-lg`}>
                <stat.icon className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Company Info & Recent Employees */}
        <div className="lg:col-span-2 space-y-8">
          {/* Company Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Building className="h-5 w-5 mr-2 text-blue-600" />
                Company Information
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Overview of your organization
              </p>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : dashboardData.companyInfo ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Name</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{dashboardData.companyInfo.name}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Established</label>
                      <p className="text-gray-900 dark:text-white">{dashboardData.companyInfo.established}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Employees</label>
                      <p className="text-gray-900 dark:text-white">{dashboardData.companyInfo.employees}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</label>
                      <p className="text-gray-900 dark:text-white">{dashboardData.companyInfo.location}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                      <p className="text-gray-900 dark:text-white">
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs font-medium">
                          Active
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Company information not available
                  </p>
                  <button
                    onClick={() => navigate('/company-profile')}
                    className="btn-secondary"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Update Company Profile
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent Employees */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-600" />
                Recent Employees
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Latest team members who joined your organization
              </p>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4 animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : dashboardData.recentEmployees && dashboardData.recentEmployees.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recentEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-700 flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                        {employee.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-lg">
                          {employee.full_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                          {employee.designation} • {employee.department}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Joined: {formatDate(employee.joining_date)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => navigate(`/edit-employee/${employee.id}`)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit Employee"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/generate-document`)}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Generate Document"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {dashboardData.totalEmployees === 0 
                      ? 'No employees yet. Start building your team!' 
                      : 'No recent employees to display'}
                  </p>
                  {dashboardData.totalEmployees === 0 && (
                    <button
                      onClick={() => navigate('/add-employee')}
                      className="mt-4 btn-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Employee
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>


        </div>

        {/* Right Column - Calendar & Quick Actions */}
        <div className="space-y-8">
          {/* Calendar Widget */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                Calendar
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Today's date and upcoming events
              </p>
            </div>
            <div className="p-6">
              <CalendarWidget />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Plus className="h-5 w-5 mr-2 text-purple-600" />
                Quick Actions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Common tasks and shortcuts
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.name}
                    to={action.href}
                    className={`block p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group ${action.color} hover:shadow-md`}
                  >
                    <div className="flex items-center">
                      <div className="p-3 bg-white/20 rounded-lg mr-4 shadow-lg">
                        <action.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white group-hover:text-white/90 transition-colors text-lg">
                          {action.name}
                        </h4>
                        <p className="text-white/80 text-sm mt-1">
                          {action.description}
                        </p>
                      </div>
                      <div className="text-white/60 group-hover:text-white/80 transition-colors">
                        <Plus className="h-5 w-5" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard 