import React, { createContext, useContext, useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.PROFILE)
      setUser(response.data.user)
    } catch (error) {
      if (error.response?.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      // Input validation
      if (!email || !email.trim()) {
        toast.error('Email is required')
        return false
      }
      
      if (!password || !password.trim()) {
        toast.error('Password is required')
        return false
      }
      
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        toast.error('Please enter a valid email address')
        return false
      }
      
      // Password length validation
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters long')
        return false
      }

      const response = await apiService.post(API_ENDPOINTS.LOGIN, { email: email.trim(), password })
      const { access_token, refresh_token, user } = response.data
      
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      
      setUser(user)
      toast.success('Login successful!')
      return true
    } catch (error) {
      // Enhanced error handling - don't show toast for validation errors as they're handled in the component
      if (error.response?.status === 400) {
        // Don't show toast - let the component handle this
      } else if (error.response?.status === 401) {
        // Don't show toast - let the component handle this
      } else if (error.response?.status === 403) {
        toast.error('Account is locked. Please contact administrator.')
      } else if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please try again later.')
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.')
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        toast.error('Network error. Please check your internet connection.')
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error('Request timeout. Please try again.')
      } else {
        // Only show generic error toast for unexpected errors
        console.error('Unexpected login error:', error)
      }
      return false
    }
  }

  const signup = async (full_name, email, password, company_name) => {
    try {
      // Input validation
      if (!full_name || !full_name.trim()) {
        toast.error('Full name is required')
        return false
      }
      
      if (!email || !email.trim()) {
        toast.error('Email is required')
        return false
      }
      
      if (!password || !password.trim()) {
        toast.error('Password is required')
        return false
      }
      
      if (!company_name || !company_name.trim()) {
        toast.error('Company name is required')
        return false
      }
      
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        toast.error('Please enter a valid email address')
        return false
      }
      
      // Password strength validation
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters long')
        return false
      }
      
      // Check for common weak passwords
      const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'user']
      if (weakPasswords.includes(password.toLowerCase())) {
        toast.error('Please choose a stronger password')
        return false
      }
      
      // Check if password contains at least one number and one letter
      if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
        toast.error('Password must contain both letters and numbers')
        return false
      }

      const userData = {
        full_name: full_name.trim(),
        email: email.trim(),
        password,
        company_name: company_name.trim()
      }
      const response = await apiService.post(API_ENDPOINTS.SIGNUP, userData)
      
      if (response.data && response.data.user) {
        // Signup successful, return the response data
        toast.success(`Account created successfully! Welcome to ${response.data.company?.name || 'your company'}. Please login to continue.`)
        return response.data
      } else {
        toast.success('Account created successfully! Please login.')
        return response.data
      }
    } catch (error) {
      console.error('❌ Signup error in AuthContext:', error)
      
      // Enhanced error handling for signup
      if (error.response?.status === 400) {
        if (error.response.data?.error?.includes('email')) {
          toast.error('Email already exists. Please use a different email or try logging in.')
        } else if (error.response.data?.error?.includes('company')) {
          toast.error('Company name is invalid or already exists.')
        } else {
          toast.error('Invalid input data. Please check your information.')
        }
      } else if (error.response?.status === 409) {
        toast.error('Account already exists with this email. Please try logging in instead.')
      } else if (error.response?.status === 422) {
        toast.error('Validation failed. Please check your input.')
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.')
      } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        toast.error('Network error. Please check your internet connection.')
      } else {
        toast.error(error.response?.data?.error || 'Signup failed. Please try again.')
      }
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const updateUser = (userData) => {
    setUser(userData)
  }

  const value = {
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 