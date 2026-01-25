// Script to add course 30 to Data Scientist career path for Feature #163 testing
const http = require('http');

// We need to update the career_paths table directly via the database
// Since there's no admin API for career paths, let's create a simple update endpoint

const data = JSON.stringify({
  course_ids: [3, 5, 4, 6, 30]  // Adding course 30 to the career path
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/career-paths/data-scientist/update-courses',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
