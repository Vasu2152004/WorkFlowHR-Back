import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { UserPlus, Building, Eye, EyeOff, ArrowLeft, Shield, User, AlertCircle, CheckCircle, Plus } from 'lucide-react'

export default function AddHRManager() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Check authentication and permissions on component mount
  useEffect(() => {
    if (user) {
      if (!['admin'].includes(user.role)) {
        toast.error('Access denied. Only administrators can add HR managers.')
        navigate('/dashboard')
        return
      }
    }
  }, [user, navigate])

  // If not authenticated, don't render the component
  if (!isAuthenticated || !user || !['admin'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">Only administrators can create HR managers.</p>
        </div>
      </div>
    )
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      setError('Full name is required')
      return false
    }
    if (formData.full_name.trim().length < 2) {
      setError('Full name must be at least 2 characters')
      return false
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }

    // Password strength validation
    if (!/\d/.test(formData.password) || !/[a-zA-Z]/.test(formData.password)) {
      setError('Password must contain both letters and numbers')
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const requestData = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password
      }
      
      const response = await apiService.post(API_ENDPOINTS.ADD_HR_MANAGER, requestData)
      
      if (response.status === 201 || response.status === 200) {
        toast.success('HR Manager added successfully!')
        setSuccess('HR Manager added successfully!')
        setFormData({
          full_name: '',
          email: '',
          password: '',
          confirmPassword: ''
        })
        // Navigate back to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } else {
        toast.error('Failed to add HR manager. Please try again.')
      }
    } catch (error) {
      console.error('Error adding HR manager:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add HR manager. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add HR Manager</h1>
              <p className="text-gray-600 dark:text-gray-400">Create a new HR manager for your company</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="card max-w-2xl">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
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

              {/* Email */}
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

              {/* Password */}
              <div>
                <label htmlFor="password" className="form-label">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="input-field pr-10"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Must be at least 8 characters with letters and numbers
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="input-field pr-10"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-700 dark:text-green-300">{success}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner h-5 w-5 mr-2"></div>
                      Adding HR Manager...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      Add HR Manager
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 card max-w-2xl">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-blue-500" />
              About HR Managers
            </h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>• HR Managers can add and manage HR staff members</p>
              <p>• They have access to employee management, leave management, and document generation</p>
              <p>• They cannot add other HR managers (only admins can do this)</p>
              <p>• They have full access to company HR operations within their scope</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

