const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Minimal server working'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// API routes with error handling
app.use('/api/auth', (req, res) => {
  res.json({ message: 'Auth endpoint reached' });
});

app.use('/api/users', (req, res) => {
  res.json({ message: 'Users endpoint reached' });
});

// Catch all
app.get('*', (req, res) => {
  res.json({ 
    message: 'Catch-all route',
    path: req.path,
    method: req.method
  });
});

// Export for Vercel
module.exports = app;

// Only start server if not in Vercel
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Minimal server running on port ${PORT}`);
  });
}
