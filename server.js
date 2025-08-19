const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
require('dotenv').config()

// Import routes
let authRoutes, userRoutes, documentRoutes, leaveRoutes, teamLeadRoutes, hrManagerRoutes, salaryRoutes, workingDaysRoutes, companyCalendarRoutes

try {
  authRoutes = require('./routes/auth')
  console.log('✅ Auth routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message)
  authRoutes = null
}

try {
  userRoutes = require('./routes/users')
  console.log('✅ User routes loaded successfully')
  
  // Test if the router is valid
  if (userRoutes && typeof userRoutes === 'function') {
    console.log('✅ User routes router is valid function')
  } else {
    console.error('❌ User routes router is not a valid function')
    userRoutes = null
  }
} catch (error) {
  console.error('❌ Failed to load user routes:', error.message)
  console.error('❌ Error stack:', error.stack)
  userRoutes = null
}

try {
  documentRoutes = require('./routes/documents')
  console.log('✅ Document routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load document routes:', error.message)
  documentRoutes = null
}

try {
  leaveRoutes = require('./routes/leaves')
  console.log('✅ Leave routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load leave routes:', error.message)
  leaveRoutes = null
}

try {
  teamLeadRoutes = require('./routes/teamLead')
  console.log('✅ Team lead routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load team lead routes:', error.message)
  teamLeadRoutes = null
}

try {
  hrManagerRoutes = require('./routes/hrManager')
  console.log('✅ HR manager routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load HR manager routes:', error.message)
  hrManagerRoutes = null
}

try {
  salaryRoutes = require('./routes/salary')
  console.log('✅ Salary routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load salary routes:', error.message)
  salaryRoutes = null
}

try {
  workingDaysRoutes = require('./routes/workingDays')
  console.log('✅ Working days routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load working days routes:', error.message)
  workingDaysRoutes = null
}

try {
  companyCalendarRoutes = require('./routes/companyCalendar')
  console.log('✅ Company calendar routes loaded successfully')
} catch (error) {
  console.error('❌ Failed to load company calendar routes:', error.message)
  companyCalendarRoutes = null
}

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

console.log('🚀 Starting WorkFlowHR server...')
console.log('🔍 Environment variables loaded:', {
  NODE_ENV,
  PORT,
  SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET'
})

console.log('✅ Basic Express app configured')

// Test endpoints - BEFORE any middleware
app.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    server: 'WorkFlowHR',
    environment: NODE_ENV
  })
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    server: 'WorkFlowHR',
    environment: NODE_ENV
  })
})

app.get('/api/ping', (req, res) => {
  res.json({ 
    message: 'API ping successful', 
    timestamp: new Date().toISOString(),
    server: 'WorkFlowHR',
    environment: NODE_ENV,
    routes: {
      auth: !!authRoutes,
      users: !!userRoutes,
      documents: !!documentRoutes,
      leaves: !!leaveRoutes,
      teamLead: !!teamLeadRoutes,
      hrManager: !!hrManagerRoutes,
      salary: !!salaryRoutes,
      workingDays: !!workingDaysRoutes,
      companyCalendar: !!companyCalendarRoutes
    }
  })
})

console.log('✅ Test endpoints configured')

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

// CORS configuration - More permissive for debugging
const corsOptions = {
  origin: true, // Allow all origins for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
app.use(cors(corsOptions))

console.log('🔍 CORS configuration:', {
  environment: NODE_ENV,
  allowedOrigins: corsOptions.origin,
  credentials: corsOptions.credentials
})

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
    }
  })
  next()
})

// Health check endpoint (moved to top, before middleware)

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
console.log('🔍 Mounting API routes...')

try {
  if (authRoutes) {
    app.use('/api/auth', authRoutes)
    console.log('✅ Auth routes mounted at /api/auth')
  }
} catch (error) {
  console.error('❌ Failed to mount auth routes:', error.message)
}

try {
  if (userRoutes) {
    app.use('/api/users', userRoutes)
    console.log('✅ User routes mounted at /api/users')
  }
} catch (error) {
  console.error('❌ Failed to mount user routes:', error.message)
}

try {
  if (documentRoutes) {
    app.use('/api/documents', documentRoutes)
    console.log('✅ Document routes mounted at /api/documents')
  }
} catch (error) {
  console.error('❌ Failed to mount document routes:', error.message)
}

try {
  if (leaveRoutes) {
    app.use('/api/leaves', leaveRoutes)
    console.log('✅ Leave routes mounted at /api/leaves')
  }
} catch (error) {
  console.error('❌ Failed to mount leave routes:', error.message)
}

try {
  if (teamLeadRoutes) {
    app.use('/api/team-lead', teamLeadRoutes)
    console.log('✅ Team lead routes mounted at /api/team-lead')
  }
} catch (error) {
  console.error('❌ Failed to mount team lead routes:', error.message)
}

try {
  if (hrManagerRoutes) {
    app.use('/api/hr-manager', hrManagerRoutes)
    console.log('✅ HR manager routes mounted at /api/hr-manager')
  }
} catch (error) {
  console.error('❌ Failed to mount HR manager routes:', error.message)
}

try {
  if (salaryRoutes) {
    app.use('/api/salary', salaryRoutes)
    console.log('✅ Salary routes mounted at /api/salary')
  }
} catch (error) {
  console.error('❌ Failed to mount salary routes:', error.message)
}

try {
  if (workingDaysRoutes) {
    app.use('/api/working-days', workingDaysRoutes)
    console.log('✅ Working days routes mounted at /api/working-days')
  }
} catch (error) {
  console.error('❌ Failed to mount working days routes:', error.message)
}

try {
  if (companyCalendarRoutes) {
    app.use('/api/company-calendar', companyCalendarRoutes)
    console.log('✅ Company calendar routes mounted at /api/company-calendar')
  }
} catch (error) {
  console.error('❌ Failed to mount company calendar routes:', error.message)
}

console.log('🔍 API routes mounting completed')

// Log essential route information
console.log('✅ Routes loaded and mounted successfully')

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    routes: [
      '/api/auth/*',
      '/api/users/*', 
      '/api/documents/*',
      '/api/leaves/*',
      '/api/team-lead/*',
      '/api/hr-manager/*',
      '/api/salary/*',
      '/api/working-days/*',
      '/api/company-calendar/*'
    ]
  })
})

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    routes: {
      auth: !!authRoutes,
      users: !!userRoutes,
      documents: !!documentRoutes,
      leaves: !!leaveRoutes,
      teamLead: !!teamLeadRoutes,
      hrManager: !!hrManagerRoutes,
      salary: !!salaryRoutes,
      workingDays: !!workingDaysRoutes,
      companyCalendar: !!companyCalendarRoutes
    }
  })
})

// Test endpoint for API routes
app.get('/api-test', (req, res) => {
  res.json({ 
    message: 'API test endpoint working!',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    routes: {
      auth: !!authRoutes,
      users: !!userRoutes,
      documents: !!documentRoutes,
      leaves: !!leaveRoutes,
      teamLead: !!teamLeadRoutes,
      hrManager: !!hrManagerRoutes,
      salary: !!salaryRoutes,
      workingDays: !!workingDaysRoutes,
      companyCalendar: !!companyCalendarRoutes
    }
  })
})

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.path)
  console.log('🔍 Request details:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: req.headers
  })
  
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.path,
    url: req.url,
    availableRoutes: [
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
    loadedRoutes: {
      auth: !!authRoutes,
      users: !!userRoutes,
      documents: !!documentRoutes,
      leaves: !!leaveRoutes,
      teamLead: !!teamLeadRoutes,
      hrManager: !!hrManagerRoutes,
      salary: !!salaryRoutes,
      workingDays: !!workingDaysRoutes,
      companyCalendar: !!companyCalendarRoutes
    }
  })
})

// Export for Vercel serverless
module.exports = app

console.log('🚀 Server module exported successfully')
console.log('🔍 Module exports:', Object.keys(module.exports))

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 WorkFlowHR server running on port ${PORT} in ${NODE_ENV} mode`)
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`)
    console.log(`🔗 API base URL: http://localhost:${PORT}/api`)
  })
} else {
  console.log('🚀 WorkFlowHR server configured for Vercel deployment')
  console.log('🔍 Environment:', NODE_ENV)
  console.log('🔍 Vercel:', process.env.VERCEL)
  console.log('🔍 Routes loaded:', {
    auth: !!authRoutes,
    users: !!userRoutes,
    documents: !!documentRoutes,
    leaves: !!leaveRoutes,
    teamLead: !!teamLeadRoutes,
    hrManager: !!hrManagerRoutes,
    salary: !!salaryRoutes,
    workingDays: !!workingDaysRoutes,
    companyCalendar: !!companyCalendarRoutes
  })
  
  // Test if the app is properly configured
  console.log('🔍 Express app configured:', {
    hasMiddleware: !!app._router,
    stackLength: app._router ? app._router.stack.length : 0
  })
  
  console.log('🚀 Server startup completed successfully!')
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  console.error('❌ Error stack:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})