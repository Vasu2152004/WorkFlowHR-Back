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

} catch (error) {
  console.error('Failed to load auth routes:', error.message)
  authRoutes = null
}

try {
  userRoutes = require('./routes/users')

} catch (error) {
  console.error('Failed to load user routes:', error.message)
  userRoutes = null
}

try {
  documentRoutes = require('./routes/documents')

} catch (error) {
  console.error('Failed to load document routes:', error.message)
  documentRoutes = null
}

try {
  leaveRoutes = require('./routes/leaves')

} catch (error) {
  console.error('Failed to load leave routes:', error.message)
  leaveRoutes = null
}

try {
  teamLeadRoutes = require('./routes/teamLead')

} catch (error) {
  console.error('Failed to load team lead routes:', error.message)
  teamLeadRoutes = null
}

try {
  hrManagerRoutes = require('./routes/hrManager')

} catch (error) {
  console.error('Failed to load HR manager routes:', error.message)
  hrManagerRoutes = null
}

try {
  salaryRoutes = require('./routes/salary')

} catch (error) {
  console.error('Failed to load salary routes:', error.message)
  salaryRoutes = null
}

try {
  workingDaysRoutes = require('./routes/workingDays')

} catch (error) {
  console.error('Failed to load working days routes:', error.message)
  workingDaysRoutes = null
}

try {
  companyCalendarRoutes = require('./routes/companyCalendar')

} catch (error) {
  console.error('Failed to load company calendar routes:', error.message)
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
  origin: true,
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
return false
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



// API routes


try {
  if (authRoutes) {
    app.use('/api/auth', authRoutes)
  }
} catch (error) {
  console.error('Failed to mount auth routes:', error.message)
}

try {
  if (userRoutes) {
    app.use('/api/users', userRoutes)
  }
} catch (error) {
  console.error('Failed to mount user routes:', error.message)
}

try {
  if (documentRoutes) {
    app.use('/api/documents', documentRoutes)
  }
} catch (error) {
  console.error('Failed to mount document routes:', error.message)
}

try {
  if (leaveRoutes) {
    app.use('/api/leaves', leaveRoutes)
  }
} catch (error) {
  console.error('Failed to mount leave routes:', error.message)
}

try {
  if (teamLeadRoutes) {
    app.use('/api/team-lead', teamLeadRoutes)
  }
} catch (error) {
  console.error('Failed to mount team lead routes:', error.message)
}

try {
  if (hrManagerRoutes) {
    app.use('/api/hr-manager', hrManagerRoutes)
  }
} catch (error) {
  console.error('Failed to mount HR manager routes:', error.message)
}

try {
  if (salaryRoutes) {
    app.use('/api/salary', salaryRoutes)
  }
} catch (error) {
  console.error('Failed to mount salary routes:', error.message)
}

try {
  if (workingDaysRoutes) {
    app.use('/api/working-days', workingDaysRoutes)
  }
} catch (error) {
  console.error('Failed to mount working days routes:', error.message)
}

try {
  if (companyCalendarRoutes) {
    app.use('/api/company-calendar', companyCalendarRoutes)
  }
} catch (error) {
  console.error('Failed to mount company calendar routes:', error.message)
}



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
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.path
  })
})

// Export for Vercel serverless
module.exports = app

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 WorkFlowHR server running on port ${PORT} in ${NODE_ENV} mode`)
  })
} else {
  console.log('🚀 WorkFlowHR server configured for Vercel deployment')
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  console.error('❌ Error stack:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})