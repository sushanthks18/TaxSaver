const axios = require('axios');

async function testReport() {
  try {
    // First login to get token
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'test2@test.com',
      password: 'Pass123!'
    });
    
    const token = loginRes.data.data.token;
    console.log('✅ Logged in, token:', token.substring(0, 20) + '...');
    
    // Generate report
    const reportRes = await axios.post(
      'http://localhost:5001/api/reports/generate',
      {
        financialYear: '2025-26',
        format: 'pdf'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Report response:', JSON.stringify(reportRes.data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testReport();
