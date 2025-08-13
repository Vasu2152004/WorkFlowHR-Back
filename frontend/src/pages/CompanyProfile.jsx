import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  Building,
  Phone,
  Mail,
  MapPin,
  Edit,
  Save,
  X,
  ExternalLink,
  Plus,
  Clock,
  Info,
  RefreshCw
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'

const CompanyProfile = () => {
  console.log('🔍 CompanyProfile component rendering...')
  
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    website: '',
    phone: '',
    address: '',
    email: ''
  })
  
  // Working days configuration state
  const [workingDaysConfig, setWorkingDaysConfig] = useState({
    working_days_per_week: 5,
    working_hours_per_day: 8.00,
    monday_working: true,
    tuesday_working: true,
    wednesday_working: true,
    thursday_working: true,
    friday_working: true,
    saturday_working: false,
    sunday_working: false
  })
  const [isEditingWorkingDays, setIsEditingWorkingDays] = useState(false)
  const [savingWorkingDays, setSavingWorkingDays] = useState(false)

  // Fetch company profile
  const fetchCompanyProfile = async () => {
    console.log('🔍 Fetching company profile...')
    setLoading(true)
    try {
      const response = await apiService.get(API_ENDPOINTS.USERS + '/company/profile')
      console.log('✅ Company profile response:', response)

      if (response.status === 200) {
        const data = response.data
        console.log('✅ Company profile data:', data)
        setCompany(data.company)
        setEditForm({
          name: data.company.name || '',
          website: data.company.website || '',
          phone: data.company.phone || '',
          address: data.company.address || '',
          email: data.company.email || ''
        })
      } else {
        throw new Error('Failed to fetch company profile')
      }
    } catch (error) {
      console.error('❌ Error fetching company profile:', error)
      setError(error.message)
      toast.error('Failed to fetch company profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch working days configuration
  const fetchWorkingDaysConfig = async () => {
    try {
      console.log('🔍 Fetching working days configuration...')
      const response = await apiService.get(API_ENDPOINTS.WORKING_DAYS + '/config')

      if (response.status === 200) {
        const data = response.data
        console.log('✅ Working days config data:', data)
        setWorkingDaysConfig(data.config)
      } else {
        const error = response.data
        console.log('⚠️ Working days config response:', response.status, error)
        // Don't show error toast for default config, just log it
        if (response.status !== 404) {
          toast.error(error.error || 'Failed to fetch working days configuration')
        }
      }
    } catch (error) {
      console.error('❌ Error fetching working days config:', error)
      // Don't show error toast for network issues, just log it
    }
  }

  useEffect(() => {
    console.log('🔍 CompanyProfile component mounted')
    fetchCompanyProfile()
    fetchWorkingDaysConfig()
  }, [])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form to original values
    setEditForm({
      name: company.name || '',
      website: company.website || '',
      phone: company.phone || '',
      address: company.address || '',
      email: company.email || ''
    })
  }

  const handleSave = async () => {
    try {
      const response = await apiService.put(API_ENDPOINTS.USERS + '/company/profile', editForm)

      if (response.status === 200) {
        const data = response.data
        setCompany(data.company)
        setIsEditing(false)
        toast.success('Company profile updated successfully!')
      } else {
        const errorData = response.data
        throw new Error(errorData.error || 'Failed to update company profile')
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update company profile')
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Working days configuration handlers
  const handleWorkingDaysChange = (field, value) => {
    setWorkingDaysConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDayToggle = (day) => {
    const newValue = !workingDaysConfig[day]
    setWorkingDaysConfig(prev => ({
      ...prev,
      [day]: newValue
    }))

    // Update working days per week count
    const workingDays = [
      'monday_working',
      'tuesday_working', 
      'wednesday_working',
      'thursday_working',
      'friday_working',
      'saturday_working',
      'sunday_working'
    ].filter(d => d === day ? newValue : workingDaysConfig[d]).length

    setWorkingDaysConfig(prev => ({
      ...prev,
      working_days_per_week: workingDays
    }))
  }

  const handleSaveWorkingDays = async () => {
    setSavingWorkingDays(true)
    try {
      const response = await apiService.put(API_ENDPOINTS.WORKING_DAYS + '/config', workingDaysConfig)

      if (response.status === 200) {
        const result = response.data
        toast.success('Working days configuration updated successfully!')
        setWorkingDaysConfig(result.config)
        setIsEditingWorkingDays(false)
      } else {
        const error = response.data
        throw new Error(error.error || 'Failed to update working days configuration')
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update working days configuration')
    } finally {
      setSavingWorkingDays(false)
    }
  }

  console.log('🔍 CompanyProfile render state:', { loading, error, company, user })

  if (loading) {
    console.log('🔍 Rendering loading state')
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-12 w-12"></div>
      </div>
    )
  }

  if (error) {
    console.log('🔍 Rendering error state')
    return (
      <div className="text-center py-12">
        <Building className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Error Loading Company Profile
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error}
        </p>
        <button
          onClick={() => {
            setError(null)
            fetchCompanyProfile()
          }}
          className="btn-primary flex items-center mx-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </button>
      </div>
    )
  }

  if (!company) {
    console.log('🔍 Rendering no company state')
    return (
      <div className="text-center py-12">
        <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Company Profile Not Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {(user?.role === 'hr' || user?.role === 'hr_manager' || user?.role === 'admin')
            ? 'No company profile has been created yet. Create one to get started.'
            : 'Company profile has not been set up yet.'
          }
        </p>
        {(user?.role === 'hr' || user?.role === 'hr_manager' || user?.role === 'admin') && (
          <button
            onClick={() => {
              setCompany({
                name: '',
                website: '',
                phone: '',
                address: '',
                email: ''
              })
              setEditForm({
                name: '',
                website: '',
                phone: '',
                address: '',
                email: ''
              })
              setIsEditing(true)
            }}
            className="btn-primary flex items-center mx-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Company Profile
          </button>
        )}
      </div>
    )
  }

  console.log('🔍 Rendering main company profile UI')
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Profile</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {(user?.role === 'hr' || user?.role === 'hr_manager' || user?.role === 'admin') ? 'Manage your company information' : 'Learn about your company'}
          </p>
        </div>
        {(user?.role === 'hr' || user?.role === 'hr_manager' || user?.role === 'admin') && (
          <div className="flex space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="btn-secondary flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className="btn-primary flex items-center"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </button>
            )}
          </div>
        )}
      </div>

      {/* Company Information */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Building className="h-5 w-5 mr-2" />
          Company Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Name</label>
            {isEditing ? (
              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter company name"
              />
            ) : (
              <p className="text-gray-900 dark:text-white font-medium">{company.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Mail className="h-5 w-5 mr-2" />
          Contact Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
            {isEditing ? (
              <input
                type="email"
                name="email"
                value={editForm.email}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter company email"
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                {company.email || 'Not specified'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
            {isEditing ? (
              <input
                type="tel"
                name="phone"
                value={editForm.phone}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter company phone"
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                {company.phone || 'Not specified'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Website</label>
            {isEditing ? (
              <input
                type="url"
                name="website"
                value={editForm.website}
                onChange={handleInputChange}
                className="input-field mt-1"
                placeholder="Enter website URL"
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                {company.website ? (
                  <a 
                    href={company.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                  >
                    {company.website}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                ) : (
                  'Not specified'
                )}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
            {isEditing ? (
              <textarea
                name="address"
                value={editForm.address}
                onChange={handleInputChange}
                rows="3"
                className="input-field mt-1"
                placeholder="Enter company address"
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                {company.address || 'Not specified'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Working Days Configuration */}
      {(user?.role === 'hr' || user?.role === 'hr_manager' || user?.role === 'admin') && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Working Days Configuration
            </h3>
            {!isEditingWorkingDays ? (
              <button
                onClick={() => setIsEditingWorkingDays(true)}
                className="btn-primary flex items-center"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Configuration
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsEditingWorkingDays(false)
                    fetchWorkingDaysConfig() // Reset to original values
                  }}
                  className="btn-secondary flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkingDays}
                  disabled={savingWorkingDays}
                  className="btn-primary flex items-center"
                >
                  {savingWorkingDays ? (
                    <>
                      <div className="loading-spinner h-4 w-4 mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            {/* Working Hours Per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Working Hours Per Day
              </label>
              {isEditingWorkingDays ? (
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={workingDaysConfig.working_hours_per_day}
                  onChange={(e) => handleWorkingDaysChange('working_hours_per_day', parseFloat(e.target.value))}
                  className="input-field w-32"
                />
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {workingDaysConfig.working_hours_per_day} hours
                </p>
              )}
            </div>

            {/* Working Days Per Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Working Days Per Week
              </label>
              <p className="text-gray-900 dark:text-white font-medium">
                {workingDaysConfig.working_days_per_week} days
              </p>
            </div>

            {/* Working Days Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Working Days
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'monday_working', label: 'Monday', icon: '1️⃣' },
                  { key: 'tuesday_working', label: 'Tuesday', icon: '2️⃣' },
                  { key: 'wednesday_working', label: 'Wednesday', icon: '3️⃣' },
                  { key: 'thursday_working', label: 'Thursday', icon: '4️⃣' },
                  { key: 'friday_working', label: 'Friday', icon: '5️⃣' },
                  { key: 'saturday_working', label: 'Saturday', icon: '6️⃣' },
                  { key: 'sunday_working', label: 'Sunday', icon: '7️⃣' }
                ].map(({ key, label, icon }) => (
                  <div key={key} className="flex items-center">
                    {isEditingWorkingDays ? (
                      <button
                        onClick={() => handleDayToggle(key)}
                        className={`flex items-center justify-center w-full p-3 rounded-lg border-2 transition-colors ${
                          workingDaysConfig[key]
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <span className="mr-2">{icon}</span>
                        <span className="font-medium">{label}</span>
                      </button>
                    ) : (
                      <div className={`flex items-center justify-center w-full p-3 rounded-lg border-2 ${
                        workingDaysConfig[key]
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        <span className="mr-2">{icon}</span>
                        <span className="font-medium">{label}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Working Days Configuration
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This configuration affects salary calculations, leave management, and working day calculations. 
                    Changes will apply to all future salary slips and leave calculations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyProfile 