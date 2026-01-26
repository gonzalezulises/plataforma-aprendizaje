// Test the specific query used in projects.js
const http = require('http');

// Make a simple HTTP request to check the project join
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/projects/7',
  method: 'GET'
};

console.log('Testing project 7 query...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
