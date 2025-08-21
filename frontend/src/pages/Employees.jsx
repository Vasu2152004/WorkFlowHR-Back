import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  User,
  Mail,
  Building,
  Briefcase,
  DollarSign,
  Calendar,
  Phone,
  MapPin,
  FileText,
  Search,
  Filter,
  MoreHorizontal,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  CreditCard
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'

const Employees = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // Fetch employees from backend
  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const response = await apiService.get(API_ENDPOINTS.USERS + '/employees')

      if (response.status === 200) {
        const data = response.data
        const employees = data.employees || []
        
        // Clean and transform employee data
        const cleanedEmployees = employees.map(emp => ({
          id: emp.id,
          full_name: emp.full_name || emp.user?.full_name || 'N/A',
          email: emp.email || emp.user?.email || 'N/A',
          department: emp.department || 'N/A',
          designation: emp.designation || 'N/A',
          salary: emp.salary || 0,
          joining_date: emp.joining_date || emp.created_at || null,
          phone_number: emp.phone_number || 'N/A',
          address: emp.address || 'N/A',
          emergency_contact: emp.emergency_contact || 'N/A',
          pan_number: emp.pan_number || 'N/A',
          bank_account: emp.bank_account || 'N/A',
          leave_balance: emp.leave_balance || 0,
          status: emp.user?.is_active ? 'active' : 'inactive',
          team_lead: emp.team_lead?.full_name || 'N/A',
          created_at: emp.created_at || new Date().toISOString()
        }))
        
        setEmployees(cleanedEmployees)
        setFilteredEmployees(cleanedEmployees)
      } else {
        throw new Error('Failed to fetch employees')
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error)
      toast.error('Failed to fetch employees')
      setEmployees([])
      setFilteredEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchEmployees()
    }
  }, [user])

  // Filter and sort employees
  useEffect(() => {
    let filtered = employees.filter(employee => {
      const matchesSearch = employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.designation?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesDepartment = !selectedDepartment || employee.department === selectedDepartment
      
      return matchesSearch && matchesDepartment
    })

    // Sort employees
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'name':
          aValue = a.full_name?.toLowerCase() || ''
          bValue = b.full_name?.toLowerCase() || ''
          break
        case 'department':
          aValue = a.department?.toLowerCase() || ''
          bValue = b.department?.toLowerCase() || ''
          break
        case 'joining_date':
          aValue = new Date(a.joining_date || 0)
          bValue = new Date(b.joining_date || 0)
          break
        case 'salary':
          aValue = parseFloat(a.salary) || 0
          bValue = parseFloat(b.salary) || 0
          break
        case 'leave_balance':
          aValue = a.leave_balance || 0
          bValue = b.leave_balance || 0
          break
        default:
          aValue = a.full_name?.toLowerCase() || ''
          bValue = b.full_name?.toLowerCase() || ''
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredEmployees(filtered)
  }, [employees, searchTerm, selectedDepartment, sortBy, sortOrder])

  const handleDeleteEmployee = async (employeeId) => {
    try {
      const response = await apiService.delete(API_ENDPOINTS.USERS + `/employees/${employeeId}`)

      if (response.status === 200) {
        toast.success('Employee deleted successfully!')
        fetchEmployees() // Refresh the list
        setShowDeleteModal(false)
        setEmployeeToDelete(null)
      } else {
        throw new Error('Failed to delete employee')
      }
    } catch (error) {
      toast.error('Failed to delete employee')
    }
  }

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee)
    setShowViewModal(true)
  }

  const handleEditEmployee = (employee) => {
    // Navigate to edit page or open edit modal
    navigate(`/edit-employee/${employee.id}`)
  }

  const handleExportEmployees = () => {
    try {
      // Create CSV content
      const headers = ['Name', 'Email', 'Department', 'Designation', 'Salary', 'Joining Date', 'Phone', 'Status', 'Leave Balance']
      const csvContent = [
        headers.join(','),
        ...filteredEmployees.map(emp => [
          `"${emp.full_name}"`,
          `"${emp.email}"`,
          `"${emp.department}"`,
          `"${emp.designation}"`,
          `"${emp.salary || 'N/A'}"`,
          `"${emp.joining_date ? formatDate(emp.joining_date) : 'N/A'}"`,
          `"${emp.phone_number !== 'N/A' ? emp.phone_number : ''}"`,
          `"${emp.status}"`,
          `"${emp.leave_balance} days"`
        ].join(','))
      ].join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Employee list exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export employee list')
    }
  }

  const getDepartments = () => {
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))]
    return departments
  }

  const formatSalary = (salary) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(salary)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-12 w-12"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage your team members ({filteredEmployees.length} employees)</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchEmployees}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/add-employee')}
            className="btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Employee
          </button>
          <button
            onClick={handleExportEmployees}
            className="btn-primary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="input-field"
            >
              <option value="">All Departments</option>
              {getDepartments().map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field"
            >
              <option value="name">Sort by Name</option>
              <option value="department">Sort by Department</option>
              <option value="joining_date">Sort by Joining Date</option>
              <option value="salary">Sort by Salary</option>
              <option value="leave_balance">Sort by Leave Balance</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="input-field"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          
          {/* Results Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Showing {filteredEmployees.length} of {employees.length} employees
                {selectedDepartment && ` in ${selectedDepartment}`}
                {searchTerm && ` matching "${searchTerm}"`}
              </span>
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  {employees.filter(emp => emp.status === 'active').length} Active
                </span>
                <span className="flex items-center">
                  <XCircle className="h-4 w-4 text-gray-500 mr-1" />
                  {employees.filter(emp => emp.status === 'inactive').length} Inactive
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="card">
        <div className="p-5">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchTerm || selectedDepartment ? 'No employees found' : 'No employees yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || selectedDepartment 
                  ? 'Try adjusting your search or filters'
                  : 'Start building your team by adding your first employee'
                }
              </p>
              {!searchTerm && !selectedDepartment && (
                <button
                  onClick={() => navigate('/add-employee')}
                  className="btn-primary"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Employee
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-professional">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Contact</th>
                    <th>Department</th>
                    <th>Salary</th>
                    <th>Joining Date</th>
                    <th>Leave Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center text-white font-semibold mr-3">
                            {employee.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {employee.full_name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {employee.designation}
                            </p>
                            {employee.team_lead !== 'N/A' && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Team: {employee.team_lead}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="text-gray-900 dark:text-white">{employee.email}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {employee.phone_number !== 'N/A' ? employee.phone_number : 'No phone'}
                          </p>
                        </div>
                      </td>
                      <td className="text-gray-900 dark:text-white">{employee.department}</td>
                      <td className="text-gray-900 dark:text-white">
                        {employee.salary ? formatSalary(employee.salary) : 'N/A'}
                      </td>
                      <td className="text-gray-900 dark:text-white">
                        {employee.joining_date ? formatDate(employee.joining_date) : 'N/A'}
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          employee.leave_balance > 10 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : employee.leave_balance > 5
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {employee.leave_balance} days
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                          {employee.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleViewEmployee(employee)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleEditEmployee(employee)}
                            className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit Employee"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => navigate(`/employee/${employee.id}/fixed-deductions`)}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="Fixed Deductions"
                          >
                            <CreditCard size={16} />
                          </button>

                          <button 
                            onClick={() => {
                              setEmployeeToDelete(employee)
                              setShowDeleteModal(true)
                            }}
                            className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Delete Employee"
                          >
                            <Trash2 size={16} />
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-strong max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-rose-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Employee
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>{employeeToDelete.full_name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setEmployeeToDelete(null)
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEmployee(employeeToDelete.id)}
                className="btn-danger"
              >
                Delete Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Employee Details
                </h3>
                <button
                  onClick={() => {
                    setShowViewModal(false)
                    setSelectedEmployee(null)
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.full_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.phone_number !== 'N/A' ? selectedEmployee.phone_number : 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.address !== 'N/A' ? selectedEmployee.address : 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Employment Details</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.department}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Designation</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.designation}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Salary</label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedEmployee.salary ? formatSalary(selectedEmployee.salary) : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Joining Date</label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedEmployee.joining_date ? formatDate(selectedEmployee.joining_date) : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Additional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Emergency Contact</label>
                    <p className="text-gray-900 dark:text-white">{selectedEmployee.emergency_contact !== 'N/A' ? selectedEmployee.emergency_contact : 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">PAN Number</label>
                    <p className="text-gray-900 dark:text-white">{selectedEmployee.pan_number !== 'N/A' ? selectedEmployee.pan_number : 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Leave Balance</label>
                    <p className="text-gray-900 dark:text-white">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedEmployee.leave_balance > 10 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : selectedEmployee.leave_balance > 5
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {selectedEmployee.leave_balance} days
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Account</label>
                    <p className="text-gray-900 dark:text-white">{selectedEmployee.bank_account !== 'N/A' ? selectedEmployee.bank_account : 'Not provided'}</p>
                  </div>
                  {selectedEmployee.team_lead !== 'N/A' && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Lead</label>
                      <p className="text-gray-900 dark:text-white">{selectedEmployee.team_lead}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                    <p className="text-gray-900 dark:text-white">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEmployee.status)}`}>
                        {selectedEmployee.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => handleEditEmployee(selectedEmployee)}
                  className="btn-primary"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Employees 