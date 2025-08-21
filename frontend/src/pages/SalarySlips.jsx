import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { 
  Download, 
  Eye, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  DollarSign, 
  FileText,
  ArrowLeft,
  Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SalarySlips() {
  const navigate = useNavigate()
  const { id: slipId } = useParams() // Get slipId from route params
  const { user } = useAuth()
  const [salarySlips, setSalarySlips] = useState([])
  const [employees, setEmployees] = useState([])
  const [salaryComponents, setSalaryComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [generatingSlip, setGeneratingSlip] = useState(false)
  
  // New state for individual slip view
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [slipDetails, setSlipDetails] = useState([])
  const [loadingSlip, setLoadingSlip] = useState(false)

  // Debug logging
  useEffect(() => {
    console.log('🔍 SalarySlips component - slipId:', slipId, 'user role:', user?.role)
  }, [slipId, user?.role])

  // Fetch salary slips and related data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch employees and salary components
      const [employeesResponse, componentsResponse] = await Promise.all([
        apiService.get(API_ENDPOINTS.EMPLOYEES),
        apiService.get(`${API_ENDPOINTS.SALARY}/components`)
      ])

      if (employeesResponse.status === 200) {
        setEmployees(employeesResponse.data.employees || [])
      }

      if (componentsResponse.status === 200) {
        setSalaryComponents(componentsResponse.data.components || [])
      }

      // Fetch salary slips based on user role
      let slipsResponse
      if (['admin', 'hr_manager', 'hr'].includes(user.role)) {
        // HR users see all salary slips
        slipsResponse = await apiService.get(API_ENDPOINTS.SALARY + '/all')
      } else {
        // Employees see only their own slips
        slipsResponse = await apiService.get(API_ENDPOINTS.SALARY + '/my-slips')
      }

      if (slipsResponse.status === 200) {
        setSalarySlips(slipsResponse.data.salarySlips || [])
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user.role])

  // Fetch individual slip details when slipId is present
  const fetchSlipDetails = useCallback(async (slipId) => {
    try {
      console.log('🔍 fetchSlipDetails called with slipId:', slipId, 'user role:', user?.role)
      setLoadingSlip(true)
      let response
      
      if (['admin', 'hr_manager', 'hr'].includes(user.role)) {
        // HR users can view any slip
        const endpoint = `${API_ENDPOINTS.SALARY}/slip/${slipId}`
        console.log('🔍 HR user - calling endpoint:', endpoint)
        response = await apiService.get(endpoint)
      } else {
        // Employees can only view their own slips
        const endpoint = `${API_ENDPOINTS.SALARY}/my-slip/${slipId}`
        console.log('🔍 Employee user - calling endpoint:', endpoint)
        response = await apiService.get(endpoint)
      }

      console.log('🔍 Response received:', response)
      if (response.status === 200) {
        setSelectedSlip(response.data.salarySlip)
        setSlipDetails(response.data.details || [])
        console.log('🔍 Slip data set:', response.data.salarySlip)
      } else {
        throw new Error('Failed to fetch slip details')
      }
    } catch (error) {
      console.error('❌ Error fetching slip details:', error)
      toast.error('Failed to load salary slip details')
      navigate('/salary-slips') // Redirect back to list if error
    } finally {
      setLoadingSlip(false)
    }
  }, [user.role, navigate])

  useEffect(() => {
    if (!user) return // Don't fetch data if user is not authenticated
    
    if (slipId) {
      // If we have a slipId, fetch that specific slip
      fetchSlipDetails(slipId)
    } else {
      // Otherwise fetch all data for list view
      fetchData()
    }
  }, [slipId, fetchSlipDetails, fetchData, user])

  const handleGenerateSalarySlip = async (formData) => {
    setGeneratingSlip(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Authentication token not found')
      }

      // Show progress message
      toast.loading('Generating salary slip... This may take a few seconds.', { duration: 0 })

      const response = await apiService.post(`${API_ENDPOINTS.SALARY}/generate`, formData)

      const result = response.data

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(result.error || 'Failed to generate salary slip')
      }

      // Dismiss loading toast and show success
      toast.dismiss()
      toast.success('Salary slip generated successfully! Email will be sent shortly.')
      setShowGenerateModal(false)
      fetchData() // Refresh the list
    } catch (error) {
      console.error('❌ Error generating salary slip:', error)
      
      // Show the actual backend error message if available
      let errorMessage = 'Failed to generate salary slip'
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setGeneratingSlip(false)
    }
  }

  const handleViewSlip = (slipId) => {
    navigate(`/salary-slip/${slipId}`)
  }

  const handleDownloadSalarySlip = async (slipId) => {
    try {
      
      const response = await apiService.get(`${API_ENDPOINTS.SALARY}/slip/${slipId}/download`, {
        responseType: 'text'
      })

      

      if (response.status === 200) {
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
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('❌ Error downloading salary slip:', error)
      toast.error('Failed to download salary slip')
    }
  }

  const filteredSlips = salarySlips.filter(slip => {
    const matchesSearch = slip.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         slip.employee?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMonth = !selectedMonth || slip.month === parseInt(selectedMonth)
    const matchesYear = slip.year === parseInt(selectedYear)
    return matchesSearch && matchesMonth && matchesYear
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1]
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
              <DollarSign className="h-8 w-8 text-green-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900 dark:text-white">
                {slipId ? 'Salary Slip Details' : 'Salary Slips'}
              </h1>
            </div>
            {!slipId && ['admin', 'hr_manager', 'hr'].includes(user.role) && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Slip
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Debug info */}
        {slipId && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Debug: slipId = {slipId}, selectedSlip = {selectedSlip ? 'loaded' : 'null'}, loadingSlip = {loadingSlip.toString()}
            </p>
          </div>
        )}

        {/* Individual Slip View */}
        {slipId && selectedSlip ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            {loadingSlip ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600 dark:text-gray-400">Loading salary slip details...</span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">SALARY SLIP</h2>
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    {getMonthName(selectedSlip.month)} {selectedSlip.year}
                  </p>
                </div>

                {/* Employee Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                      Employee Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Name:</span>
                        <span className="text-gray-900 dark:text-white">{selectedSlip.employee?.full_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Employee ID:</span>
                        <span className="text-gray-900 dark:text-white">{selectedSlip.employee?.employee_id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Department:</span>
                        <span className="text-gray-900 dark:text-white">{selectedSlip.employee?.department || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Designation:</span>
                        <span className="text-gray-900 dark:text-white">{selectedSlip.employee?.designation || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                      Salary Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Basic Salary:</span>
                        <span className="text-gray-900 dark:text-white font-semibold">₹{selectedSlip.basic_salary || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Gross Salary:</span>
                        <span className="text-gray-900 dark:text-white font-semibold">₹{selectedSlip.gross_salary || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Net Salary:</span>
                        <span className="text-gray-900 dark:text-white font-semibold text-green-600 dark:text-green-400">₹{selectedSlip.net_salary || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Unpaid Leaves:</span>
                        <span className="text-gray-900 dark:text-white">{selectedSlip.unpaid_leaves || 0} days</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown */}
                {slipDetails.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                      Salary Breakdown
                    </h3>
                    
                    {/* Additions */}
                    {slipDetails.filter(d => d.component_type === 'addition').length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                          Additions
                        </h4>
                        <div className="space-y-2">
                          {slipDetails.filter(d => d.component_type === 'addition').map((detail, index) => (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <span className="text-gray-700 dark:text-gray-300">{detail.component_name}</span>
                              <span className="text-green-600 dark:text-green-400 font-semibold">+₹{detail.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deductions */}
                    {slipDetails.filter(d => d.component_type === 'deduction').length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          Deductions
                        </h4>
                        <div className="space-y-2">
                          {slipDetails.filter(d => d.component_type === 'deduction').map((detail, index) => (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <span className="text-gray-700 dark:text-gray-300">{detail.component_name}</span>
                              <span className="text-red-600 dark:text-red-400 font-semibold">-₹{detail.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => navigate('/salary-slips')}
                    className="btn-secondary flex items-center"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                  </button>
                  <button
                    onClick={() => handleDownloadSalarySlip(selectedSlip.id)}
                    className="btn-primary flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                </div>
              </>
            )}
          </div>
        ) : slipId && loadingSlip ? (
          /* Loading state for individual slip */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading salary slip details...</span>
            </div>
          </div>
        ) : slipId && !selectedSlip && !loadingSlip ? (
          /* Error state for individual slip */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Salary Slip Not Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The requested salary slip could not be found or you don't have permission to view it.
              </p>
              <button
                onClick={() => navigate('/salary-slips')}
                className="btn-secondary flex items-center mx-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Salary Slips
              </button>
            </div>
          </div>
        ) : (
          /* List View - existing code */
          <>
            {/* Filters */}
            <div className="card mb-6">
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by employee name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>

                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthName(i + 1)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="input-field"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      )
                    })}
                  </select>

                  <button
                    onClick={fetchData}
                    className="btn-secondary flex items-center justify-center"
                  >
                    <Filter className="h-5 w-5 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Salary Slips List */}
            <div className="card">
              <div className="p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="loading-spinner h-8 w-8"></div>
                  </div>
                ) : filteredSlips.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No salary slips found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {searchTerm || selectedMonth ? 'Try adjusting your search or filters' : 'Generate your first salary slip'}
                    </p>
                    {!searchTerm && !selectedMonth && (
                      <button
                        onClick={() => setShowGenerateModal(true)}
                        className="btn-primary"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Generate First Salary Slip
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSlips.map((slip) => (
                      <div key={slip.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center">
                              <DollarSign className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {slip.employee?.full_name || 'Unknown Employee'}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {getMonthName(slip.month)} {slip.year} • {slip.employee?.department || 'N/A'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(slip.net_salary)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Net Salary
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewSlip(slip.id)}
                              className="btn-secondary flex items-center"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </button>
                                                 <button 
                           onClick={() => handleDownloadSalarySlip(slip.id)}
                           className="btn-secondary flex items-center"
                         >
                           <Download className="h-4 w-4 mr-2" />
                           Download
                         </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Gross Salary</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(slip.gross_salary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Additions</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              +{formatCurrency(slip.total_additions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Deductions</p>
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              -{formatCurrency(slip.total_deductions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Unpaid Leaves</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {slip.unpaid_leaves} days
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Generate Salary Slip Modal */}
      {showGenerateModal && (
        <GenerateSalarySlipModal
          employees={employees}
          salaryComponents={salaryComponents}
          onGenerate={handleGenerateSalarySlip}
          onClose={() => setShowGenerateModal(false)}
          loading={generatingSlip}
        />
      )}
    </div>
  )
}

// Generate Salary Slip Modal Component
function GenerateSalarySlipModal({ employees, salaryComponents, onGenerate, onClose, loading }) {
  const [formData, setFormData] = useState({
    employee_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    additions: [],
    deductions: [],
    notes: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.employee_id) {
      toast.error('Please select an employee')
      return
    }
    
    onGenerate(formData)
  }

  const addComponent = (type) => {
    const newComponent = {
      component_id: '',
      component_name: '',
      amount: '',
      description: ''
    }
    
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], newComponent]
    }))
  }

  const updateComponent = (type, index, field, value) => {
    setFormData(prev => {
      const updatedComponents = prev[type].map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // If component_id is being updated, also update component_name
          if (field === 'component_id' && value) {
            const selectedComponent = salaryComponents.find(comp => comp.id === value);
            if (selectedComponent) {
              updatedItem.component_name = selectedComponent.name;
            }
          }
          
          return updatedItem;
        }
        return item;
      });
      
      return {
        ...prev,
        [type]: updatedComponents
      };
    });
  }

  const removeComponent = (type, index) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Generate Salary Slip
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Employee *</label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                  required
                  className="input-field"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Month *</label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                  required
                  className="input-field"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Year *</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  required
                  className="input-field"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Additions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Additions (Bonuses, Allowances, etc.)
                </h3>
                <button
                  type="button"
                  onClick={() => addComponent('additions')}
                  className="btn-secondary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.additions.map((addition, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
                    <select
                      value={addition.component_id}
                      onChange={(e) => updateComponent('additions', index, 'component_id', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select Component</option>
                      {salaryComponents.filter(c => c.component_type === 'addition').map(comp => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Component Name"
                      value={addition.component_name}
                      onChange={(e) => updateComponent('additions', index, 'component_name', e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={addition.amount}
                      onChange={(e) => updateComponent('additions', index, 'amount', e.target.value)}
                      className="input-field"
                    />
                    <button
                      type="button"
                      onClick={() => removeComponent('additions', index)}
                      className="btn-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Deductions (Tax, Insurance, etc.)
                </h3>
                <button
                  type="button"
                  onClick={() => addComponent('deductions')}
                  className="btn-secondary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.deductions.map((deduction, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
                    <select
                      value={deduction.component_id}
                      onChange={(e) => updateComponent('deductions', index, 'component_id', e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select Component</option>
                      {salaryComponents.filter(c => c.component_type === 'deduction').map(comp => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Component Name"
                      value={deduction.component_name}
                      onChange={(e) => updateComponent('deductions', index, 'component_name', e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={deduction.amount}
                      onChange={(e) => updateComponent('deductions', index, 'amount', e.target.value)}
                      className="input-field"
                    />
                    <button
                      type="button"
                      onClick={() => removeComponent('deductions', index)}
                      className="btn-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows="3"
                className="input-field"
                placeholder="Any additional notes for this salary slip..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
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
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Generate Salary Slip
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Helper function
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1]
} 