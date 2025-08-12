const axios = require('axios');

// Test production endpoints
async function testProduction() {
  const baseUrl = process.argv[2] || 'https://your-vercel-url.vercel.app';
  
  console.log('🧪 Testing Production Endpoints...');
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log('─'.repeat(50));
  
  try {
    // Test health endpoint
    console.log('🏥 Testing /health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✅ Health endpoint:', healthResponse.status, healthResponse.data);
    
    // Test route testing endpoint
    console.log('\n🧪 Testing /test endpoint...');
    const testResponse = await axios.get(`${baseUrl}/test`);
    console.log('✅ Test endpoint:', testResponse.status, testResponse.data);
    
    // Test API endpoint
    console.log('\n🔌 Testing /api endpoint...');
    try {
      const apiResponse = await axios.get(`${baseUrl}/api/users`);
      console.log('✅ API endpoint:', apiResponse.status, 'Working');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ API endpoint: Working (401 Unauthorized - expected)');
      } else {
        console.log('❌ API endpoint error:', error.response?.status, error.response?.data);
      }
    }
    
    // Test non-existent route
    console.log('\n🚫 Testing non-existent route...');
    try {
      await axios.get(`${baseUrl}/nonexistent`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ 404 handling: Working correctly');
      } else {
        console.log('❌ 404 handling error:', error.response?.status);
      }
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
if (require.main === module) {
  testProduction();
}

module.exports = { testProduction };
