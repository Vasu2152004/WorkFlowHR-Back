const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
require('dotenv').config()

// Import routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const documentRoutes = require('./routes/documents')
const leaveRoutes = require('./routes/leaves')
const teamLeadRoutes = require('./routes/teamLead')
const hrManagerRoutes = require('./routes/hrManager')
const salaryRoutes = require('./routes/salary')
const workingDaysRoutes = require('./routes/workingDays')
const companyCalendarRoutes = require('./routes/companyCalendar')

// Optional email routes
let emailRoutes = null
try {
  emailRoutes = require('./routes/email')
} catch (error) {
  // Email routes not available - email functionality disabled
}

const app = express()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// Debug: Log environment variables
console.log('🔍 Environment Check:', {
  NODE_ENV,
  PORT,
  SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET'
})

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? [process.env.CORS_ORIGIN || 'https://your-frontend-domain.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health'
  }
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb'
}))
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb' 
}))

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const logMessage = `${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    
    if (res.statusCode >= 400) {
      console.error(logMessage)
    } else {
      console.log(logMessage)
    }
  })
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

// API status endpoint for frontend debugging
app.get('/api/status', (req, res) => {
  res.json({
    status: 'API is working',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    endpoints: [
      '/health',
      '/api/auth/*',
      '/api/users/*',
      '/api/documents/*',
      '/api/leaves/*',
      '/api/team-lead/*',
      '/api/hr-manager/*',
      '/api/salary/*',
      '/api/working-days/*',
      '/api/company-calendar/*'
    ],
    cors: {
      origin: corsOptions.origin,
      credentials: corsOptions.credentials
    }
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/team-lead', teamLeadRoutes)
app.use('/api/hr-manager', hrManagerRoutes)
app.use('/api/salary', salaryRoutes)
app.use('/api/working-days', workingDaysRoutes)
app.use('/api/company-calendar', companyCalendarRoutes)

// Debug: Log all registered routes
console.log('🔍 Registered API Routes:')
console.log('  - /api/auth')
console.log('  - /api/users') 
console.log('  - /api/documents')
console.log('  - /api/leaves')
console.log('  - /api/team-lead')
console.log('  - /api/hr-manager')
console.log('  - /api/salary')
console.log('  - /api/working-days')
console.log('  - /api/company-calendar')

// Email routes (if available)
if (emailRoutes) {
  app.use('/api/email', emailRoutes)
}

// Global error handler
app.use((error, req, res, next) => {
  // Handle validation errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  
  // Handle rate limit errors
  if (error.status === 429) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  
  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' })
  }
  
  // Log the error
  console.error('Unhandled error:', error)
  
  // Send error response
  const statusCode = error.statusCode || 500
  const message = NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message || 'Something went wrong'
  
  res.status(statusCode).json({ 
    error: message,
    ...(NODE_ENV === 'development' && { stack: error.stack })
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Export for Vercel serverless
module.exports = app

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 WorkFlowHR server running on port ${PORT} in ${NODE_ENV} mode`)
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`)
    console.log(`🔗 API base URL: http://localhost:${PORT}/api`)
  })
}