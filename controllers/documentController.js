const { supabase } = require('../config/supabase')
const puppeteer = require('puppeteer')

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return supabase && supabase.from && typeof supabase.from === 'function'
}

// Get all document templates for the company
const getDocumentTemplates = async (req, res) => {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning mock templates for testing')
      
      // Return mock templates for testing when Supabase is not available
      const mockTemplates = [
        {
          id: 'template-1',
          document_name: 'Employee Offer Letter',
          field_tags: [
            { tag: 'employee_name', label: 'Employee Name', required: true },
            { tag: 'position', label: 'Position', required: true },
            { tag: 'start_date', label: 'Start Date', required: true },
            { tag: 'salary', label: 'Salary', required: true }
          ],
          content: '<h1>Employee Offer Letter</h1><p>Dear {{employee_name}},</p><p>We are pleased to offer you the position of {{position}} at our company.</p><p>Your start date will be {{start_date}} with a salary of {{salary}}.</p>',
          settings: {},
          company_id: req.user?.company_id || 'test-company',
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'template-2',
          document_name: 'Leave Request Form',
          field_tags: [
            { tag: 'employee_name', label: 'Employee Name', required: true },
            { tag: 'leave_type', label: 'Leave Type', required: true },
            { tag: 'start_date', label: 'Start Date', required: true },
            { tag: 'end_date', label: 'End Date', required: true },
            { tag: 'reason', label: 'Reason', required: false }
          ],
          content: '<h1>Leave Request Form</h1><p>Employee: {{employee_name}}</p><p>Leave Type: {{leave_type}}</p><p>From: {{start_date}} To: {{end_date}}</p><p>Reason: {{reason}}</p>',
          settings: {},
          company_id: req.user?.company_id || 'test-company',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]
      
      return res.json({ templates: mockTemplates })
    }

    const { data: templates, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('company_id', req.user.company_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching templates:', error)
      return res.status(500).json({ 
        error: 'Failed to fetch templates',
        details: error.message 
      })
    }

    res.json({ templates: templates || [] })
  } catch (error) {
    console.error('Error fetching templates:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

// Get single document template
const getDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params

    const { data: template, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.user.company_id)
      .single()

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    res.json({ template })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Create new document template
const createDocumentTemplate = async (req, res) => {
  try {
    console.log('🔄 Creating document template...')
    console.log('📝 Request body:', { 
      document_name: req.body.document_name,
      field_tags_count: req.body.field_tags?.length || 0,
      content_length: req.body.content?.length || 0,
      user: req.user ? { id: req.user.id, company_id: req.user.company_id } : 'No user'
    })

    const { document_name, field_tags, content, settings = {} } = req.body

    // Validate required fields
    if (!document_name || !field_tags || !content) {
      console.log('❌ Validation failed:', { document_name: !!document_name, field_tags: !!field_tags, content: !!content })
      return res.status(400).json({ 
        error: 'Document name, field tags, and content are required' 
      })
    }

    // Validate field_tags structure
    if (!Array.isArray(field_tags) || field_tags.length === 0) {
      console.log('❌ Field tags validation failed:', { field_tags })
      return res.status(400).json({ 
        error: 'At least one field tag is required' 
      })
    }

    // Validate each field tag
    for (let i = 0; i < field_tags.length; i++) {
      const field = field_tags[i]
      if (!field.tag || !field.label) {
        console.log('❌ Field tag validation failed at index', i, field)
        return res.status(400).json({ 
          error: `Field ${i + 1} must have both tag and label` 
        })
      }
    }

    // Check for duplicate tags
    const tags = field_tags.map(f => f.tag)
    const uniqueTags = [...new Set(tags)]
    if (tags.length !== uniqueTags.length) {
      console.log('❌ Duplicate tags found:', tags)
      return res.status(400).json({ 
        error: 'Duplicate field tags are not allowed' 
      })
    }

    // Validate user object
    if (!req.user) {
      console.error('❌ User object missing in createDocumentTemplate')
      return res.status(401).json({ 
        error: 'User authentication required' 
      })
    }

    if (!req.user.company_id) {
      console.error('❌ User company_id missing:', req.user)
      return res.status(400).json({ 
        error: 'User company information missing' 
      })
    }

    console.log('✅ Validation passed, checking Supabase configuration...')
    console.log('👤 User object details:', {
      id: req.user?.id,
      company_id: req.user?.company_id,
      email: req.user?.email,
      role: req.user?.role,
      full_user_object: req.user
    })

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, returning mock success for testing')
      
      // Return mock success for testing when Supabase is not available
      const mockTemplate = {
        id: `template-${Date.now()}`,
        document_name,
        field_tags,
        content,
        settings,
        company_id: req.user.company_id,
        created_by: req.user.id,
        is_active: true,
        created_at: new Date().toISOString()
      }
      
      console.log('✅ Mock template created successfully')
      return res.status(201).json({ 
        message: 'Template created successfully (mock mode)',
        template: mockTemplate 
      })
    }

    console.log('🔄 Supabase configured, creating template in database...')

    // Test foreign key references first
    console.log('🔍 Testing foreign key references...')
    
    // Check if company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', req.user.company_id)
      .single()
    
    if (companyError || !company) {
      console.error('❌ Company not found:', req.user.company_id)
      return res.status(400).json({ 
        error: 'Company not found',
        details: `Company ID ${req.user.company_id} does not exist`
      })
    }
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.user.id)
      .single()
    
    if (userError || !user) {
      console.error('❌ User not found:', req.user.id)
      return res.status(400).json({ 
        error: 'User not found',
        details: `User ID ${req.user.id} does not exist`
      })
    }
    
    console.log('✅ Foreign key references verified')

    // Create template with better error handling
    try {
      const insertData = {
        company_id: req.user.company_id,
        document_name,
        field_tags,
        content,
        settings,
        created_by: req.user.id,
        is_active: true
      }
      
      console.log('📝 Inserting data:', insertData)
      
      const { data: template, error } = await supabase
        .from('document_templates')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase error creating template:', error)
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // Check for specific error types
        if (error.code === '23502') {
          return res.status(500).json({ 
            error: 'Missing required field in database',
            details: error.message 
          })
        } else if (error.code === '42P01') {
          return res.status(500).json({ 
            error: 'Database table not found',
            details: 'document_templates table does not exist'
          })
        } else if (error.code === '23503') {
          return res.status(500).json({ 
            error: 'Foreign key constraint violation',
            details: error.message 
          })
        } else {
          return res.status(500).json({ 
            error: 'Failed to create template',
            details: error.message 
          })
        }
      }

      console.log('✅ Template created successfully in database:', template.id)

      res.status(201).json({ 
        message: 'Template created successfully',
        template 
      })
      
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError)
      return res.status(500).json({ 
        error: 'Database operation failed',
        details: dbError.message 
      })
    }
  } catch (error) {
    console.error('❌ Unexpected error in createDocumentTemplate:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

// Update document template
const updateDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params
    const { document_name, field_tags, content, settings = {}, is_active } = req.body

    // Validate required fields
    if (!document_name || !field_tags || !content) {
      return res.status(400).json({ 
        error: 'Document name, field tags, and content are required' 
      })
    }

    // Validate field_tags structure
    if (!Array.isArray(field_tags) || field_tags.length === 0) {
      return res.status(400).json({ 
        error: 'At least one field tag is required' 
      })
    }

    // Validate each field tag
    for (let i = 0; i < field_tags.length; i++) {
      const field = field_tags[i]
      if (!field.tag || !field.label) {
        return res.status(400).json({ 
          error: `Field ${i + 1} must have both tag and label` 
        })
      }
    }

    // Check for duplicate tags
    const tags = field_tags.map(f => f.tag)
    const uniqueTags = [...new Set(tags)]
    if (tags.length !== uniqueTags.length) {
      return res.status(400).json({ 
        error: 'Duplicate field tags are not allowed' 
      })
    }

    // Update template
    const { data: template, error } = await supabase
      .from('document_templates')
      .update({
        document_name: document_name.trim(),
        field_tags: field_tags,
        content: content,
        settings: settings,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.user.company_id)
      .select('*')
      .single()

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    res.json({ 
      message: 'Template updated successfully',
      template 
    })

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Delete document template (soft delete)
const deleteDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params

    const { data: template, error } = await supabase
      .from('document_templates')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.user.company_id)
      .select('*')
      .single()

    if (error || !template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    res.json({ 
      message: 'Template deleted successfully',
      template 
    })

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Generate document from template
const generateDocument = async (req, res) => {
  try {
    const { template_id, field_values } = req.body

    if (!template_id || !field_values) {
      return res.status(400).json({ 
        error: 'Template ID and field values are required' 
      })
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', template_id)
      .eq('company_id', req.user.company_id)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Replace placeholders with values
    let generatedContent = template.content
    template.field_tags.forEach(field => {
      const placeholder = `{{${field.tag}}}`
      const value = field_values[field.tag] || `[${field.label}]`
      generatedContent = generatedContent.replace(new RegExp(placeholder, 'g'), value)
    })

    // Generate PDF with proper formatting preservation
    console.log('🔄 Starting PDF generation...')
    const pdfBuffer = await generatePDFFromHTML(generatedContent)
    console.log('📊 PDF generation completed, buffer size:', pdfBuffer.length)
    console.log('🔍 Buffer starts with:', pdfBuffer.toString().substring(0, 100))

    // Check if we got a PDF or HTML fallback
    if (pdfBuffer.toString().startsWith('%PDF')) {
      // It's a PDF
      console.log('✅ Detected PDF content, setting PDF headers')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${template.document_name}_${new Date().toISOString().split('T')[0]}.pdf"`)
      res.setHeader('Content-Length', pdfBuffer.length)
    } else {
      // It's HTML fallback
      console.log('⚠️ Detected HTML fallback content, setting HTML headers')
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Content-Disposition', `attachment; filename="${template.document_name}_${new Date().toISOString().split('T')[0]}.html"`)
      res.setHeader('Content-Length', pdfBuffer.length)
    }
    
    res.send(pdfBuffer)

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Generate PDF from HTML content with formatting preservation
const generatePDFFromHTML = async (htmlContent) => {
  let browser
  
  try {
    // Method 1: Try Puppeteer with serverless-friendly options
    console.log('🔄 Attempting PDF generation with Puppeteer...')
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    })

    const page = await browser.newPage()
    
    // Create a complete HTML document with proper styling
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Generated Document</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background: white;
              padding: 40px;
              font-size: 14px;
            }
            
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              font-weight: 600;
              line-height: 1.25;
            }
            
            h1 { font-size: 2.25em; }
            h2 { font-size: 1.875em; }
            h3 { font-size: 1.5em; }
            h4 { font-size: 1.25em; }
            h5 { font-size: 1.125em; }
            h6 { font-size: 1em; }
            
            p {
              margin-bottom: 1em;
              text-align: justify;
            }
            
            ul, ol {
              margin-bottom: 1em;
              padding-left: 1.5em;
            }
            
            li {
              margin-bottom: 0.25em;
            }
            
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 1em;
              margin: 1em 0;
              font-style: italic;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1em 0;
            }
            
            th, td {
              border: 1px solid #d1d5db;
              padding: 0.5em;
              text-align: left;
            }
            
            th {
              background-color: #f9fafb;
              font-weight: 600;
            }
            
            @page {
              margin: 1in;
              size: A4;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `

    await page.setContent(fullHTML, { waitUntil: 'networkidle0' })

    // Generate PDF with proper settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true
    })

    console.log('✅ PDF generated successfully with Puppeteer')
    return pdf

  } catch (error) {
    console.error('❌ Puppeteer PDF generation failed:', error.message)
    
    // Method 2: Try to use a different approach or fallback
    try {
      console.log('🔄 Attempting alternative PDF generation...')
      
      // For now, return HTML with instructions for manual PDF conversion
      const fallbackHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Generated Document (Manual PDF Conversion)</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background: white;
                padding: 40px;
                font-size: 14px;
                max-width: 800px;
                margin: 0 auto;
              }
              
              h1, h2, h3, h4, h5, h6 {
                margin-top: 1.5em;
                margin-bottom: 0.5em;
                font-weight: 600;
                line-height: 1.25;
              }
              
              h1 { font-size: 2.25em; }
              h2 { font-size: 1.875em; }
              h3 { font-size: 1.5em; }
              h4 { font-size: 1.25em; }
              h5 { font-size: 1.125em; }
              h6 { font-size: 1em; }
              
              p {
                margin-bottom: 1em;
                text-align: justify;
              }
              
              ul, ol {
                margin-bottom: 1em;
                padding-left: 1.5em;
              }
              
              li {
                margin-bottom: 0.25em;
              }
              
              blockquote {
                border-left: 4px solid #e5e7eb;
                padding-left: 1em;
                margin: 1em 0;
                font-style: italic;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
              }
              
              th, td {
                border: 1px solid #d1d5db;
                padding: 0.5em;
                text-align: left;
              }
              
              th {
                background-color: #f9fafb;
                font-weight: 600;
              }
              
              .conversion-notice {
                background: #dbeafe;
                border: 1px solid #3b82f6;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
                color: #1e40af;
              }
              
              .conversion-notice h3 {
                margin-top: 0;
                color: #1e3a8a;
              }
              
              .conversion-steps {
                background: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 8px;
                padding: 16px;
                margin: 16px 0;
              }
              
              .conversion-steps ol {
                margin: 0;
                padding-left: 20px;
              }
              
              .conversion-steps li {
                margin-bottom: 8px;
              }
              
              @media print {
                body { padding: 20px; }
                .conversion-notice, .conversion-steps { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="conversion-notice">
              <h3>📄 Manual PDF Conversion Required</h3>
              <p><strong>PDF generation is temporarily unavailable in the current environment.</strong></p>
              <p>This document has been generated as HTML. Please follow the steps below to convert it to PDF.</p>
            </div>
            
            <div class="conversion-steps">
              <h4>How to Convert to PDF:</h4>
              <ol>
                <li><strong>Save this file</strong> as an HTML file (.html extension)</li>
                <li><strong>Open it in your web browser</strong> (Chrome, Firefox, Edge, etc.)</li>
                <li><strong>Use Print function</strong> (Ctrl+P or Cmd+P)</li>
                <li><strong>Select "Save as PDF"</strong> as the destination</li>
                <li><strong>Choose your preferred settings</strong> and save</li>
              </ol>
            </div>
            
            <hr style="margin: 32px 0; border: none; border-top: 2px solid #e5e7eb;">
            
            ${htmlContent}
          </body>
        </html>
      `
      
      console.log('🔄 Returning HTML with manual conversion instructions')
      return Buffer.from(fallbackHTML, 'utf8')
      
    } catch (fallbackError) {
      console.error('❌ Fallback generation also failed:', fallbackError.message)
      
      // Final fallback: Simple HTML
      const simpleHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Document</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
            </style>
          </head>
          <body>
            <h2>PDF Generation Unavailable</h2>
            <p>Please contact support or try again later.</p>
            <hr>
            ${htmlContent}
          </body>
        </html>
      `
      
      return Buffer.from(simpleHTML, 'utf8')
    }
    
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.warn('⚠️ Error closing browser:', closeError.message)
      }
    }
  }
}

module.exports = {
  getDocumentTemplates,
  getDocumentTemplate,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  generateDocument
} 