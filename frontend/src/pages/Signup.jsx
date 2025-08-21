import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Building, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'

const Signup = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company_name: ''
  })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    setErrors({})
    
    try {
      const result = await signup(
        formData.full_name,
        formData.email,
        formData.password,
        formData.company_name
      )
      
      if (result) {
        toast.success('Account created successfully! Please login to continue.')
        navigate('/login')
      }
    } catch (error) {
      console.error('Signup error:', error)
      const errorMessage = error.response?.data?.error || 'Signup failed. Please try again.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Clear previous errors
    setErrors({})
    
    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required'
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters'
    }
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address'
      }
    }
    
    // Company name validation
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required'
    } else if (formData.company_name.trim().length < 2) {
      newErrors.company_name = 'Company name must be at least 2 characters'
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    } else if (!/\d/.test(formData.password) || !/[a-zA-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain both letters and numbers'
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    
    return true
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: '' }))
    }
  }



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mb-4">
            <Building className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Create Company & Admin Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            Create a new company and your first admin account
          </p>
        </div>

        {/* Signup Form */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="form-label">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                className={`input-field ${errors.full_name ? 'border-red-500' : ''}`}
                placeholder="Enter your full name"
              />
              {errors.full_name && (
                <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="company_name" className="form-label">
                Company Name
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className={`input-field ${errors.company_name ? 'border-red-500' : ''}`}
                placeholder="Enter your company name"
              />
              {errors.company_name && (
                <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={`input-field pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className={`input-field pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="loading-spinner h-5 w-5 mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>



            {/* Company Isolation Note */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              <p>Each company is completely isolated. You can create a new company even if others exist.</p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 dark:text-gray-400 mb-2">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-blue-700 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200 font-medium"
              >
                Sign in
              </Link>
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Note: Only company administrators can create accounts. Regular employees will be added by HR.
            </p>
          </div>
        </div>

        {/* Security Features */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center text-slate-500 dark:text-gray-400">
            <Building className="h-4 w-4 mr-2 text-blue-500" />
            <span className="text-sm">Enterprise-grade security</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup 