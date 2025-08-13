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
      const response = await apiService.post(API_ENDPOINTS.LOGIN, { email, password })
      const { access_token, refresh_token, user } = response.data
      
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      
      setUser(user)
      toast.success('Login successful!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed')
      return false
    }
  }

  const signup = async (full_name, email, password, company_name) => {
    try {
      const userData = {
        full_name,
        email,
        password,
        company_name
      }
      const response = await apiService.post(API_ENDPOINTS.SIGNUP, userData)
      
      console.log('🔍 Signup response:', response.data)
      
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
      toast.error(error.response?.data?.error || 'Signup failed')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 