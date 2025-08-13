import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Building, Eye, EyeOff, TestTube } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      console.log('🔍 Starting signup process...')
      console.log('🔍 Form data:', formData)
      console.log('🔍 API endpoint:', API_ENDPOINTS.SIGNUP)
      
      const result = await signup(formData.full_name, formData.email, formData.password, formData.company_name)
      console.log('✅ Signup result:', result)
      console.log('🔍 Result type:', typeof result)
      console.log('🔍 Result keys:', result ? Object.keys(result) : 'No result')
      
      if (result && result.user) {
        // Signup successful, redirect to login
        toast.success(`Account created successfully! Welcome to ${result.company?.name || 'your company'}. Please login to continue.`)
        navigate('/login')
      } else {
        toast.error('Signup failed - unexpected response format')
      }
    } catch (error) {
      console.error('❌ Signup error:', error)
      
      // Handle specific error messages from the backend
      if (error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Signup failed - please try again')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const testApiConnection = async () => {
    try {
      console.log('🧪 Testing API connection...')
      
      // Test basic connection
      const connectionTest = await apiService.get('/auth/test-connection')
      console.log('✅ Connection test:', connectionTest.data)
      
      // Test schema
      const schemaTest = await apiService.get('/auth/test-schema')
      console.log('✅ Schema test:', schemaTest.data)
      
      toast.success('API connection test successful!')
    } catch (error) {
      console.error('❌ API test failed:', error)
      toast.error('API test failed: ' + (error.response?.data?.error || error.message))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
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
                className="input-field"
                placeholder="Enter your full name"
              />
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
                className="input-field"
                placeholder="Enter your email"
              />
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
                className="input-field"
                placeholder="Enter your company name"
              />
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
                  className="input-field pr-10"
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
                  className="input-field pr-10"
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

            {/* Test API Connection Button */}
            <button
              type="button"
              onClick={testApiConnection}
              className="btn-secondary w-full flex items-center justify-center"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test API Connection
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