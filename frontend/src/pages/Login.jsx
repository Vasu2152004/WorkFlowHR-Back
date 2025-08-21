import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Building, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [loginError, setLoginError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Persist form data and error state
  useEffect(() => {
    const savedEmail = localStorage.getItem('login_email')
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }))
    }
  }, [])

  // Save email to localStorage when it changes
  useEffect(() => {
    if (formData.email) {
      localStorage.setItem('login_email', formData.email)
    }
  }, [formData.email])

  // Clear saved email on successful login
  const clearSavedData = () => {
    localStorage.removeItem('login_email')
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    
    // Don't clear form data on validation errors
    // Keep user's input so they can fix and retry
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Check for too many attempts
    if (attempts >= 5) {
      toast.error('Too many login attempts. Please wait 5 minutes before trying again.')
      return
    }
    
    setLoading(true)
    setErrors({})
    setLoginError('')

    try {
      const success = await login(formData.email, formData.password)
      if (success) {
        // Reset attempts on successful login
        setAttempts(0)
        clearSavedData() // Clear saved email
        navigate('/dashboard')
      } else {
        // Increment attempts on failed login
        setAttempts(prev => prev + 1)
        
        // Show warning for multiple attempts
        if (attempts >= 3) {
          setLoginError(`Login failed. ${5 - attempts} attempts remaining before temporary lockout.`)
        } else {
          setLoginError('Invalid email or password. Please check your credentials and try again.')
        }
        
        // Keep the error message visible for a reasonable time
        setTimeout(() => {
          // Only clear error if user hasn't started typing again
          if (formData.password === '') {
            setLoginError('')
          }
        }, 5000) // Keep error visible for 5 seconds
        
        // Don't clear the form on failed login - keep user's input
        // Only clear the password field for security
        setFormData(prev => ({
          ...prev,
          password: ''
        }))
        
        // Focus on password field for retry
        setTimeout(() => {
          const passwordField = document.getElementById('password')
          if (passwordField) {
            passwordField.focus()
          }
        }, 100)
      }
    } catch (error) {
      setAttempts(prev => prev + 1)
      console.error('Login error:', error)
      
      // Set appropriate error message
      if (error.response?.status === 401) {
        setLoginError('Invalid email or password. Please check your credentials.')
      } else if (error.response?.status === 403) {
        setLoginError('Account is locked. Please contact your administrator.')
      } else if (error.response?.status === 429) {
        setLoginError('Too many login attempts. Please wait before trying again.')
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        setLoginError('Network error. Please check your internet connection.')
      } else {
        setLoginError('Login failed. Please try again later.')
      }
      
      // Don't clear the form on error - keep user's input
      // Only clear the password field for security
      setFormData(prev => ({
        ...prev,
        password: ''
      }))
      
      // Keep the error message visible for a reasonable time
      setTimeout(() => {
        // Only clear error if user hasn't started typing again
        if (formData.password === '') {
          setLoginError('')
        }
      }, 5000) // Keep error visible for 5 seconds
      
      // Focus on password field for retry
      setTimeout(() => {
        const passwordField = document.getElementById('password')
        if (passwordField) {
          passwordField.focus()
        }
      }, 100)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    // Clear login error when user starts typing, but with a small delay
    if (loginError) {
      setTimeout(() => {
        setLoginError('')
      }, 1000) // Clear error after 1 second of typing
    }
  }

  const handleForgotPassword = () => {
    toast.error('Password reset functionality is not available yet. Please contact your administrator.')
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
            Welcome Back
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            Sign in to your WorkFlowHR account
          </p>
        </div>

        {/* Login Form */}
        <div className="card p-6">
          {/* Login Error Display */}
          {loginError && (
            <div className={`mb-4 p-3 border rounded-md ${
              attempts >= 3 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm ${
                attempts >= 3 
                  ? 'text-orange-600 dark:text-orange-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {loginError}
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
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
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
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
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || attempts >= 5}
              className={`w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                attempts >= 5
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="loading-spinner h-4 w-4 mr-2"></div>
                  Signing In...
                </div>
              ) : attempts >= 5 ? 'Too Many Attempts' : 'Sign In'}
            </button>
            
            {/* Attempts Counter */}
            {attempts > 0 && attempts < 5 && (
              <div className="text-center">
                <p className={`text-sm ${
                  attempts >= 3 
                    ? 'text-red-600 dark:text-red-400 font-medium' 
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {attempts} failed attempt{attempts > 1 ? 's' : ''} • {5 - attempts} remaining
                  {attempts >= 3 && ' • Warning: Account may be locked soon'}
                </p>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link 
                to="/signup" 
                className="text-blue-700 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200 font-medium"
              >
                Sign up
              </Link>
            </p>
            <p className="text-slate-600 dark:text-gray-400 mt-2">
              <a 
                onClick={handleForgotPassword} 
                className="cursor-pointer text-blue-700 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200 font-medium"
              >
                Forgot Password?
              </a>
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

export default Login 