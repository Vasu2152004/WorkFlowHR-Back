import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService, API_ENDPOINTS } from '../config/api'
import { toast } from 'react-hot-toast'
import { Calendar, Clock, MapPin, Users, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const CompanyCalendar = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    type: 'holiday',
    is_recurring: false,
    recurring_pattern: ''
  })

  useEffect(() => {
    if (user) {
      fetchEvents()
    }
  }, [user, currentDate, filterType])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching calendar events...')
      
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      let url = `${API_ENDPOINTS.COMPANY_CALENDAR}/events?month=${month}&year=${year}`
      if (filterType) {
        url += `&type=${filterType}`
      }

      console.log('📡 API URL:', url)
      const response = await apiService.get(url)

      console.log('📊 API Response:', response)

      if (response.status === 200) {
        setEvents(response.data || [])
        console.log('✅ Events fetched successfully:', response.data)
      } else {
        throw new Error(`Failed to fetch events: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Error fetching events:', error)
      toast.error('Failed to fetch calendar events')
      setEvents([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🔄 Submitting calendar event...')
      console.log('📝 Form data:', formData)

      const url = isEditing 
        ? `${API_ENDPOINTS.COMPANY_CALENDAR}/events/${selectedEvent.id}`
        : `${API_ENDPOINTS.COMPANY_CALENDAR}/events`
      
      console.log('📡 API URL:', url)
      
      const response = isEditing 
        ? await apiService.put(url, formData)
        : await apiService.post(url, formData)

      console.log('📊 API Response:', response)

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data?.error || 'Failed to save calendar event')
      }

      const data = response.data
      toast.success(data.message || 'Calendar event saved successfully')
      
      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        date: '',
        type: 'holiday',
        is_recurring: false,
        recurring_pattern: ''
      })
      setSelectedEvent(null)
      setIsEditing(false)
      setShowModal(false)
      
      // Refresh events
      fetchEvents()
    } catch (error) {
      console.error('❌ Error saving event:', error)
      toast.error(error.message || 'Failed to save calendar event')
    } finally {
      setLoading(false)
    }
  }

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      console.log('🔄 Deleting calendar event:', eventId)
      
      const response = await apiService.delete(`${API_ENDPOINTS.COMPANY_CALENDAR}/events/${eventId}`)

      console.log('📊 Delete API Response:', response)

      if (response.status !== 200) {
        throw new Error(response.data?.error || 'Failed to delete calendar event')
      }

      const data = response.data
      toast.success(data.message)
      fetchEvents()
    } catch (error) {
      console.error('❌ Error deleting event:', error)
      toast.error(error.message || 'Failed to delete calendar event')
    }
  }

  const handleEdit = (event) => {
    setSelectedEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      date: event.date,
      type: event.type,
      is_recurring: event.is_recurring || false,
      recurring_pattern: event.recurring_pattern || ''
    })
    setIsEditing(true)
    setShowModal(true)
  }

  const handleAddNew = () => {
    setSelectedEvent(null)
    setFormData({
      title: '',
      description: '',
      date: '',
      type: 'holiday',
      is_recurring: false,
      recurring_pattern: ''
    })
    setIsEditing(false)
    setShowModal(true)
  }

  const getEventIcon = (type) => {
    switch (type) {
      case 'holiday':
        return <MapPin className="w-4 h-4 text-red-500" />
      case 'special_day':
        return <Users className="w-4 h-4 text-yellow-500" />
      case 'company_event':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'optional_holiday':
        return <MapPin className="w-4 h-4 text-green-500" />
      default:
        return <Calendar className="w-4 h-4 text-gray-500" />
    }
  }

  const getEventColor = (type) => {
    switch (type) {
      case 'holiday':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'special_day':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'company_event':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'optional_holiday':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const filteredEvents = events.filter(event => {
    if (!filterType) return true
    return event.type === filterType
  })

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Please login to view calendar</h2>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calendar events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Calendar</h1>
          <p className="text-gray-600">View and manage company holidays and events</p>
        </div>
        
        {/* Navigation and Controls */}
        <div className="flex items-center space-x-4">
          {/* Month Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-lg min-w-[120px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Events</option>
            <option value="holiday">Holidays</option>
            <option value="special_day">Special Days</option>
            <option value="company_event">Company Events</option>
            <option value="optional_holiday">Optional Holidays</option>
          </select>

          {/* Add New Event Button (HR only) */}
          {['hr', 'hr_manager', 'admin'].includes(user.role) && (
            <button
              onClick={handleAddNew}
              className="btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </button>
          )}
        </div>
      </div>

      {/* Calendar Events */}
      <div className="bg-white rounded-lg shadow-md">
        {loading ? (
          <div className="p-8 text-center">
            <div className="loading-spinner h-8 w-8 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Found</h3>
            <p className="text-gray-600">
              {filterType ? `No ${filterType.replace('_', ' ')} events found for this month.` : 'No events found for this month.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getEventColor(event.type)}`}>
                          {event.type.replace('_', ' ')}
                        </span>
                        {event.is_recurring && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            Recurring
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-2">{formatDate(event.date)}</p>
                      {event.description && (
                        <p className="text-gray-700">{event.description}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons (HR only) */}
                  {['hr', 'hr_manager', 'admin'].includes(user.role) && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(event)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Event"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isEditing ? 'Edit Calendar Event' : 'Add New Calendar Event'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="holiday">Holiday</option>
                    <option value="special_day">Special Day</option>
                    <option value="company_event">Company Event</option>
                    <option value="optional_holiday">Optional Holiday</option>
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Recurring Event</span>
                  </label>
                </div>

                {formData.is_recurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recurring Pattern
                    </label>
                    <select
                      value={formData.recurring_pattern}
                      onChange={(e) => setFormData({ ...formData, recurring_pattern: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Pattern</option>
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (isEditing ? 'Update Event' : 'Add Event')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyCalendar