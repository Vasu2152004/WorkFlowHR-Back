import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  FileText,
  Download,
  Eye,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileDown,
  RefreshCw,
  Edit,
  Trash2,
  Plus
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiService, API_ENDPOINTS } from '../config/api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const GenerateDocument = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [previewContent, setPreviewContent] = useState('')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingTemplate, setDeletingTemplate] = useState(null)

  // Fetch available templates
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await apiService.get(API_ENDPOINTS.DOCUMENTS + '/templates')

      if (response.status === 200) {
        const data = response.data
        setTemplates(data.templates || [])
        
        if (data.templates && data.templates.length === 0) {
          setError('No templates found. Create some templates first.')
        }
      } else {
        if (response.status === 401) {
          toast.error('Session expired. Please login again.')
          return
        }
        if (response.status === 403) {
          setError('Access denied. You need HR permissions to view templates.')
          toast.error('Access denied. You need HR permissions to view templates.')
          return
        }
        throw new Error(`Failed to fetch templates: ${response.status}`)
      }
    } catch (error) {
      setError(error.message || 'Failed to load templates')
      toast.error(error.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setIsPreviewMode(false)
    
    // Initialize field values with empty strings
    const initialValues = {}
    template.field_tags.forEach(field => {
      initialValues[field.tag] = ''
    })
    setFieldValues(initialValues)
    setPreviewContent('')
  }

  const updateFieldValue = (tag, value) => {
    setFieldValues(prev => ({
      ...prev,
      [tag]: value
    }))
  }

  const updatePreview = () => {
    if (!selectedTemplate) return
    
    let content = selectedTemplate.content
    Object.keys(fieldValues).forEach(tag => {
      const placeholder = `{{${tag}}}`
      const value = fieldValues[tag] || `[${tag}]`
      content = content.replace(new RegExp(placeholder, 'g'), value)
    })
    setPreviewContent(content)
    setIsPreviewMode(true) // Enable preview mode
  }

  const validateFields = () => {
    if (!selectedTemplate) {
      setError('Please select a template first')
      toast.error('Please select a template first')
      return false
    }

    const requiredFields = selectedTemplate.field_tags.filter(field => field.required)
    for (const field of requiredFields) {
      if (!fieldValues[field.tag] || fieldValues[field.tag].trim() === '') {
        setError(`Please fill in the required field: ${field.label}`)
        toast.error(`Please fill in the required field: ${field.label}`)
        return false
      }
    }

    return true
  }

  const generatePDF = async () => {
    if (!validateFields()) return

    try {
      setGenerating(true)
      setError('')
      
      console.log('🚀 Attempting PDF generation with endpoint:', API_ENDPOINTS.GENERATE_DOCUMENT)
      console.log('📋 Template ID:', selectedTemplate.id)
      console.log('📝 Field values:', fieldValues)
      
      const response = await apiService.post(API_ENDPOINTS.GENERATE_DOCUMENT, {
        template_id: selectedTemplate.id,
        field_values: fieldValues
      }, {
        responseType: 'blob' // Important: Set response type to blob for PDF/HTML
      })
      
      console.log('🔍 PDF Generation Response:', {
        status: response.status,
        headers: response.headers,
        dataType: typeof response.data,
        dataLength: response.data?.length || 'N/A'
      })

      if (response.status === 200) {
        // Check content type to determine if it's PDF or HTML
        const contentType = response.headers['content-type']
        const isPDF = contentType && contentType.includes('application/pdf')
        const isHTML = contentType && contentType.includes('text/html')
        
        let blob, filename, fileExtension
        
        if (isPDF) {
          // Handle PDF response
          blob = new Blob([response.data], { type: 'application/pdf' })
          fileExtension = 'pdf'
        } else if (isHTML) {
          // Handle HTML fallback response
          blob = new Blob([response.data], { type: 'text/html' })
          fileExtension = 'html'
        } else {
          // Fallback: try to detect by content
          const content = response.data
          if (content.toString().startsWith('%PDF')) {
            blob = new Blob([content], { type: 'application/pdf' })
            fileExtension = 'pdf'
          } else {
            blob = new Blob([content], { type: 'text/html' })
            fileExtension = 'html'
          }
        }
        
        filename = `${selectedTemplate.document_name}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
        
        // Download the file
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        if (fileExtension === 'html') {
          setSuccess('Document generated as HTML! You can open it in your browser and use Print > Save as PDF.')
          toast.success('HTML document generated! Use browser Print function to save as PDF.')
        } else {
          setSuccess('Document generated and downloaded successfully!')
          toast.success('PDF document generated successfully!')
        }
      } else {
        throw new Error('Failed to generate document')
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.')
        return
      }
      if (error.response?.status === 403) {
        setError('Access denied. You need HR permissions to generate documents.')
        toast.error('Access denied. You need HR permissions to generate documents.')
        return
      }
      setError(error.message || 'Failed to generate document')
      toast.error(error.message || 'Failed to generate document')
    } finally {
      setGenerating(false)
    }
  }

  // Generate PDF using client-side generation
  const generatePDFClientSide = async () => {
    if (!selectedTemplate) return
    
    try {
      setGenerating(true)
      setError('')
      
      // Create a temporary div to render the content
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = previewContent
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '0'
      tempDiv.style.width = '800px' // A4 width
      tempDiv.style.padding = '40px'
      tempDiv.style.fontFamily = 'Arial, sans-serif'
      tempDiv.style.fontSize = '14px'
      tempDiv.style.lineHeight = '1.6'
      tempDiv.style.color = '#333'
      tempDiv.style.backgroundColor = 'white'
      
      // Add to DOM temporarily
      document.body.appendChild(tempDiv)
      
      // Convert to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.scrollHeight
      })
      
      // Remove temporary div
      document.body.removeChild(tempDiv)
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 295 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      // Add first page
      pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Save the PDF
      const filename = `${selectedTemplate.document_name}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
      
      setSuccess('PDF generated and downloaded successfully!')
      toast.success('PDF generated successfully!')
      
    } catch (error) {
      console.error('PDF generation error:', error)
      setError('Failed to generate PDF. Please try again.')
      toast.error('PDF generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const resetForm = () => {
    setSelectedTemplate(null)
    setFieldValues({})
    setPreviewContent('')
    setIsPreviewMode(false)
  }

  const handleEditTemplate = (template) => {
    navigate(`/edit-template/${template.id}`)
  }

  const handleDeleteTemplate = async (template) => {
    if (!confirm(`Are you sure you want to delete "${template.document_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingTemplate(template.id)
      const response = await apiService.delete(API_ENDPOINTS.GET_TEMPLATE(template.id))

      if (response.status === 200) {
        toast.success('Template deleted successfully!')
        fetchTemplates() // Refresh the list
      } else {
        throw new Error('Failed to delete template')
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.')
        return
      }
      if (error.response?.status === 403) {
        toast.error('Access denied. You need HR permissions to delete templates.')
        return
      }
      toast.error(error.message || 'Failed to delete template')
    } finally {
      setDeletingTemplate(null)
    }
  }

  if (!user || user.role !== 'hr') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only HR users can generate documents.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate Document</h1>
            <p className="text-gray-600 dark:text-gray-300">Select a template and generate documents with dynamic content</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Template Selection & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Select Template
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Available</h3>
                <p className="text-gray-600 mb-4">Create some document templates first to generate documents.</p>
                <button
                  onClick={() => window.location.href = '/create-template'}
                  className="btn-primary"
                >
                  Create Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {template.document_name}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {selectedTemplate?.id === template.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditTemplate(template)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit template"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTemplate(template)
                          }}
                          disabled={deletingTemplate === template.id}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Delete template"
                        >
                          {deletingTemplate === template.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div
                      onClick={() => handleTemplateSelect(template)}
                      className="cursor-pointer"
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {template.field_tags.length} dynamic field{template.field_tags.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Created: {new Date(template.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field Values Form */}
          {selectedTemplate && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Enter Document Values
              </h3>
              
              <div className="space-y-4">
                {selectedTemplate.field_tags.map((field) => (
                  <div key={field.tag}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.label}
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={fieldValues[field.tag] || ''}
                      onChange={(e) => updateFieldValue(field.tag, e.target.value)}
                      className="input-field"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={updatePreview}
                  disabled={!Object.values(fieldValues).some(value => value.trim() !== '')}
                  className="btn-secondary flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </button>
                <button
                  onClick={resetForm}
                  className="btn-outline flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {isPreviewMode && previewContent && (
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document Preview</h3>
                <div className="flex gap-3">
                  <button
                    onClick={generatePDFClientSide}
                    disabled={!selectedTemplate || generating}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF (Recommended)
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={generatePDF}
                    disabled={generating || !validateFields()}
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Server-side generation (may not work in production)"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Try Server PDF
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 min-h-[400px] bg-white dark:bg-gray-800">
                <div 
                  className="prose max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              </div>
            </div>
          )}

          {/* Error & Success Messages */}
          {(error || success) && (
            <div className="card p-6">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 mb-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 mb-4">
                  <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Help & Info */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How to Generate</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>1. <strong>Select a template</strong> - Choose from available document templates</p>
              <p>2. <strong>Fill in the fields</strong> - Enter values for all required fields</p>
              <p>3. <strong>Preview</strong> - Review how your document will look</p>
              <p>4. <strong>Download</strong> - Generate and download the PDF document</p>
            </div>
          </div>

          {selectedTemplate && (
            <div className="card p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">Template Info</h3>
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p><strong>Name:</strong> {selectedTemplate.document_name}</p>
                <p><strong>Fields:</strong> {selectedTemplate.field_tags.length}</p>
                <p><strong>Created:</strong> {new Date(selectedTemplate.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4">Tips</h3>
            <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
              <li>• All fields marked with * are required</li>
              <li>• Preview your document before downloading</li>
              <li>• PDF will maintain exact formatting and fonts</li>
              <li>• Generated documents are automatically named with date</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenerateDocument 