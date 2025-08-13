const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, requireHR, validateCompanyAccess } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router();

// TEMPORARY: Development test route (remove in production)
router.get('/test-templates', (req, res) => {
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
      company_id: 'test-company',
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
      company_id: 'test-company',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ]
  
  res.json({ templates: mockTemplates })
});

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateCreateTemplate = [
  body('document_name').trim().isLength({ min: 2 }).withMessage('Document name must be at least 2 characters'),
  body('field_tags').isArray({ min: 1 }).withMessage('At least one field tag is required'),
  body('field_tags.*.tag').notEmpty().withMessage('Field tag is required'),
  body('field_tags.*.label').notEmpty().withMessage('Field label is required'),
  body('content').notEmpty().withMessage('Document content is required')
];

const validateUpdateTemplate = [
  body('document_name').trim().isLength({ min: 2 }).withMessage('Document name must be at least 2 characters'),
  body('field_tags').isArray({ min: 1 }).withMessage('At least one field tag is required'),
  body('field_tags.*.tag').notEmpty().withMessage('Field tag is required'),
  body('field_tags.*.label').notEmpty().withMessage('Field label is required'),
  body('content').notEmpty().withMessage('Document content is required')
];

const validateGenerateDocument = [
  body('template_id').notEmpty().withMessage('Template ID is required'),
  body('field_values').isObject().withMessage('Field values must be an object')
];

// Document template routes (HR only)
router.get('/templates', requireHR, documentController.getDocumentTemplates);
router.get('/templates/:id', requireHR, documentController.getDocumentTemplate);
router.post('/templates', requireHR, validateCreateTemplate, documentController.createDocumentTemplate);
router.put('/templates/:id', requireHR, validateUpdateTemplate, documentController.updateDocumentTemplate);
router.delete('/templates/:id', requireHR, documentController.deleteDocumentTemplate);

// Generate document from template (HR only)
router.post('/generate-document', validateGenerateDocument, documentController.generateDocument);

// Debug: Log all document routes
console.log('📄 Document Routes Registered:')
console.log('  - GET /test-templates')
console.log('  - GET /templates')
console.log('  - GET /templates/:id')
console.log('  - POST /templates')
console.log('  - PUT /templates/:id')
console.log('  - DELETE /templates/:id')
console.log('  - POST /generate-document')

module.exports = router; 