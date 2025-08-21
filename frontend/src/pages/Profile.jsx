import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, Building, Calendar, Shield, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'

const Profile = () => {
  const { user, updateUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: ''
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  const [errors, setErrors] = useState({})
  const [passwordErrors, setPasswordErrors] = useState({})

  // Initialize form data when user data is available
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || ''
      })
    }
  }, [user])

  const validateProfileForm = () => {
    const newErrors = {}
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required'
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    
    // Clear previous errors
    setErrors({})
    
    // Validate form
    if (!validateProfileForm()) {
      return
    }
    
    setLoading(true)
    
    try {
      const response = await apiService.put(API_ENDPOINTS.UPDATE_PROFILE, formData)
      
      if (response.status === 200) {
        toast.success('Profile updated successfully!')
        
        // Update the user context with new data
        if (updateUser && response.data.user) {
          updateUser(response.data.user)
        }
        
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Profile update error:', error)
      const errorMessage = error.response?.data?.error || 'Failed to update profile'
      toast.error(errorMessage)
      
      // Don't clear the form on error - keep user's input
      // The form data remains intact so user can fix and retry
    } finally {
      setLoading(false)
    }
  }

  const validatePasswordForm = () => {
    const newErrors = {}
    
    if (!passwordData.currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required'
    }
    
    if (!passwordData.newPassword.trim()) {
      newErrors.newPassword = 'New password is required'
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'New password must be at least 6 characters'
    }
    
    if (!passwordData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your new password'
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setPasswordErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    // Clear previous errors
    setPasswordErrors({})
    
    // Validate form
    if (!validatePasswordForm()) {
      return
    }
    
    setPasswordLoading(true)
    
    try {
      const response = await apiService.put(API_ENDPOINTS.CHANGE_PASSWORD, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      
      if (response.status === 200) {
        toast.success('Password changed successfully!')
        
        // Reset form only on success
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
        
        setIsChangingPassword(false)
      }
    } catch (error) {
      console.error('Password change error:', error)
      const errorMessage = error.response?.data?.error || 'Failed to change password'
      toast.error(errorMessage)
      
      // Don't clear the form on error - keep user's input
      // Only clear the current password field for security
      setPasswordData(prev => ({
        ...prev,
        currentPassword: ''
      }))
    } finally {
      setPasswordLoading(false)
    }
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const profileInfo = [
    {
      label: 'Full Name',
      value: user?.full_name || 'Not set',
      icon: User
    },
    {
      label: 'Email',
      value: user?.email || 'Not set',
      icon: Mail
    },
    {
      label: 'Company',
      value: user?.company_name || 'Your Company',
      icon: Building
    },
    {
      label: 'Role',
      value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Not set',
      icon: Shield
    },
    {
      label: 'Member Since',
      value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
      icon: Calendar
    }
  ]

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600">Please login to view your profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account information and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex flex-col items-center p-6">
              <div className="h-24 w-24 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-white">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.full_name || 'User'}</h2>
              <p className="text-gray-600 dark:text-gray-400">{user?.email || 'No email'}</p>
              <span className="mt-2 inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {user?.role || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h3>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn-secondary"
                disabled={loading}
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => {
                      setFormData({...formData, full_name: e.target.value})
                      // Clear error when user starts typing
                      if (errors.full_name) {
                        setErrors(prev => ({ ...prev, full_name: '' }))
                      }
                    }}
                    className={`input-field mt-1 ${errors.full_name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                    minLength={2}
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({...formData, email: e.target.value})
                      // Clear error when user starts typing
                      if (errors.email) {
                        setErrors(prev => ({ ...prev, email: '' }))
                      }
                    }}
                    className={`input-field mt-1 ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                  )}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary flex items-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner h-4 w-4 mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {profileInfo.map((info, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex-shrink-0">
                      <info.icon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{info.label}</p>
                      <p className="text-sm text-gray-900 dark:text-white">{info.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Settings</h3>
        
        {isChangingPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({...passwordData, currentPassword: e.target.value})
                      // Clear error when user starts typing
                      if (passwordErrors.currentPassword) {
                        setPasswordErrors(prev => ({ ...prev, currentPassword: '' }))
                      }
                    }}
                    className={`input-field pr-10 ${passwordErrors.currentPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPasswords.current ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.currentPassword}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="input-field pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPasswords.new ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <div className="relative mt-1">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="input-field pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordData.newPassword && passwordData.confirmPassword && (
                <div className="mt-1">
                  {passwordData.newPassword === passwordData.confirmPassword ? (
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Passwords match
                    </p>
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsChangingPassword(false)}
                className="btn-secondary"
                disabled={passwordLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary flex items-center"
                disabled={passwordLoading || passwordData.newPassword !== passwordData.confirmPassword}
              >
                {passwordLoading ? (
                  <>
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Change Password</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
              </div>
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="btn-secondary flex items-center"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
              </div>
              <button className="btn-secondary" disabled>
                Enable
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Download your account data</p>
            </div>
            <button className="btn-secondary" disabled>
              Export
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Delete Account</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete your account</p>
            </div>
            <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200" disabled>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile 