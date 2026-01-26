const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // Login as instructor
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'instructor@test.com',
    name: 'Test Instructor',
    role: 'instructor_admin',
    id: 2
  });

  const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

  // Get submissions via pending-review (instructor-accessible)
  const res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects/pending/review',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  console.log('Pending submissions:', JSON.stringify(res.data, null, 2));
}

main().catch(console.error);
