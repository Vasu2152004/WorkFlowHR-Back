const express = require('express');
const cors = require('cors');
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'WorkFlowHR server is working!',
    version: '1.0.0'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Simple API endpoints that don't require database
app.get('/api/status', (req, res) => {
  res.json({
    status: 'API is working',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/test', '/api/status', '/api/auth/*', '/api/users/*']
  });
});

// Auth endpoints (mock responses for now)
app.post('/api/auth/login', (req, res) => {
  res.json({
    message: 'Login endpoint reached',
    note: 'Database connection required for actual authentication'
  });
});

app.post('/api/auth/signup', (req, res) => {
  res.json({
    message: 'Signup endpoint reached',
    note: 'Database connection required for actual user creation'
  });
});

// Users endpoint (mock response)
app.get('/api/users', (req, res) => {
  res.json({
    message: 'Users endpoint reached',
    note: 'Database connection required for actual user data'
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  res.json({ 
    message: 'WorkFlowHR API Server',
    path: req.path,
    method: req.method,
    status: 'Server is running but some features require database connection'
  });
});

// Export for Vercel
module.exports = app;

// Only start server if not in Vercel
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`WorkFlowHR server running on port ${PORT}`);
  });
}
