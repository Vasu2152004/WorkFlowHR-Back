import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { Calendar, Clock, Save, ArrowLeft, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function WorkingDaysConfig() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [config, setConfig] = useState({
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)


  // Fetch current configuration
  const fetchConfig = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        toast.error('Authentication token not found')
        return
      }

      const response = await apiService.get(API_ENDPOINTS.WORKING_DAYS_CONFIG)

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to fetch configuration')
      }
    } catch (error) {
      console.error('Error fetching config:', error)
      toast.error('Failed to fetch configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  // Handle form changes
  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle day toggle
  const handleDayToggle = (day) => {
    const newValue = !config[day]
    setConfig(prev => ({
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
    ].filter(d => d === day ? newValue : config[d]).length

    setConfig(prev => ({
      ...prev,
      working_days_per_week: workingDays
    }))
  }

  // Save configuration
  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Authentication token not found')
      }

      const response = await apiService.put(API_ENDPOINTS.WORKING_DAYS_CONFIG, config)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update configuration')
      }

      toast.success('Working days configuration updated successfully!')
      setConfig(result.config)
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error(error.message || 'Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Working Days Configuration</h1>
              <p className="mt-2 text-gray-600">
                Configure working days and hours for your company. This affects salary calculations and leave management.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Working Days Settings</h2>
            
            {/* Working Hours Per Day */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Working Hours Per Day
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={config.working_hours_per_day}
                onChange={(e) => handleChange('working_hours_per_day', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Working Days Per Week */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Working Days Per Week: {config.working_days_per_week}
              </label>
              <div className="text-sm text-gray-500">
                This is automatically calculated based on the days selected below.
              </div>
            </div>

            {/* Days of the Week */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Working Days</h3>
              
              {[
                { key: 'monday_working', label: 'Monday' },
                { key: 'tuesday_working', label: 'Tuesday' },
                { key: 'wednesday_working', label: 'Wednesday' },
                { key: 'thursday_working', label: 'Thursday' },
                { key: 'friday_working', label: 'Friday' },
                { key: 'saturday_working', label: 'Saturday' },
                { key: 'sunday_working', label: 'Sunday' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <button
                    onClick={() => handleDayToggle(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      config[key] ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="mt-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Clock className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>


          

            {/* Information */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <div className="flex">
                <Settings className="h-5 w-5 text-blue-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">How it works</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>• Working days configuration affects salary calculations and leave management</p>
                    <p>• Salary is calculated based on 30 days per month for daily rate</p>
                    <p>• Leave deductions are calculated based on working days only</p>
                    <p>• Changes take effect immediately for new salary slips</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}