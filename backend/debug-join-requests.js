// Quick test script to debug the join requests API
const https = require('http');

// Admin user from the database: e0900539-4ea9-457f-97ee-bc69823b5f65
// Chama ID: 40bc1928-c978-44fe-b7e6-9b979e7db48b

// First we need a token - let's create a simple JWT
const jwt = require('jsonwebtoken');

// Create a token for the admin user
const token = jwt.sign(
  { sub: 'e0900539-4ea9-457f-97ee-bc69823b5f65' },
  'dev-secret',
  { expiresIn: '1h' },
);

console.log('Using token:', token);

// Test the API endpoint
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/chama/40bc1928-c978-44fe-b7e6-9b979e7db48b/invite/requests',
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response:', body);
    try {
      const json = JSON.parse(body);
      console.log('Parsed:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Could not parse as JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
