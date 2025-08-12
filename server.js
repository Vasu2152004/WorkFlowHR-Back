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
  console.warn('⚠️  Email routes not available - email functionality disabled:', error.message)
}

// Validate critical routes
const requiredRoutes = [authRoutes, userRoutes, documentRoutes, leaveRoutes, teamLeadRoutes, hrManagerRoutes, salaryRoutes, workingDaysRoutes, companyCalendarRoutes]
const missingRoutes = requiredRoutes.filter(route => !route)

if (missingRoutes.length > 0) {
  console.warn('⚠️  Some required routes are missing:', missingRoutes.length, 'routes failed to load')
}

const app = express()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// Validate critical environment variables in production
if (NODE_ENV === 'production') {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing required environment variables in production:', missingVars)
    console.warn('Please set all required environment variables before deploying to production')
    // Don't exit in serverless environment, just log warning
    if (process.env.VERCEL !== '1') {
      process.exit(1)
    }
  } else {
    console.log('✅ All required environment variables are set for production')
  }
}

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
    ? '*' // Allow all origins in production for Vercel
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
  
  // Log all incoming requests in production for debugging
  if (NODE_ENV === 'production') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'Unknown'}`)
  }
  
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

// Serve static files from the React app (only in development)
if (NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, 'frontend/dist'), {
    maxAge: '0'
  }))
}

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    // Check if critical environment variables are available
    const hasSupabaseUrl = !!process.env.SUPABASE_URL
    const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY
    
    res.json({ 
      status: hasSupabaseUrl && hasSupabaseKey ? 'OK' : 'WARNING',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      supabase_configured: hasSupabaseUrl && hasSupabaseKey,
      supabase_url_set: hasSupabaseUrl,
      supabase_key_set: hasSupabaseKey,
      routes: ['/health', '/api/*'],
      vercel: process.env.VERCEL === '1'
    })
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Route testing endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Route testing successful',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    path: req.path,
    method: req.method,
    headers: req.headers
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

// Email routes (if available)
if (emailRoutes) {
  app.use('/api/email', emailRoutes)
}

// Catch all handler: send back React's index.html file for any non-API routes (only in development)
if (NODE_ENV === 'development') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'))
  })
} else {
  // In production, handle all routes that don't match API routes
  app.get('*', (req, res) => {
    // If it's not an API route, return a simple response
    if (!req.path.startsWith('/api/') && req.path !== '/health') {
      res.status(404).json({ 
        error: 'Route not found',
        message: 'This is a backend API server. Frontend routes are not available.',
        availableRoutes: ['/health', '/api/*']
      })
    } else {
      res.status(404).json({ error: 'Route not found' })
    }
  })
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
if (NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 WorkFlowHR server running on port ${PORT} in ${NODE_ENV} mode`)
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`)
    console.log(`🔗 API base URL: http://localhost:${PORT}/api`)
  })
} 