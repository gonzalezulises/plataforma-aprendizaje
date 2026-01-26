// Test creating a single course via API
const http = require('http');

function makeRequest(method, path, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let body = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), setCookie });
        } catch {
          resolve({ status: res.statusCode, data: body, setCookie });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // Login
  console.log('Logging in...');
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', {
    email: 'instructor@test.com',
    password: 'password123'
  });
  console.log('Login response:', loginRes.status, loginRes.data);

  let cookie = '';
  if (loginRes.setCookie) {
    cookie = loginRes.setCookie[0].split(';')[0];
    console.log('Got session cookie:', cookie);
  }

  // Check current count
  console.log('\nChecking current courses...');
  const current = await makeRequest('GET', '/api/courses', null, cookie);
  console.log('Current total:', current.data.total);

  // Try to create a course
  console.log('\nCreating test course...');
  const course = {
    title: 'PERF_TEST_SINGLE: Test Course',
    description: 'Test course for feature 236',
    category: 'Testing',
    level: 'Principiante',
    is_premium: 0,
    is_published: 1,
    duration_hours: 10
  };

  const createRes = await makeRequest('POST', '/api/courses', course, cookie);
  console.log('Create response:', createRes.status, JSON.stringify(createRes.data).substring(0, 500));

  // Check count again
  console.log('\nChecking courses after create...');
  const after = await makeRequest('GET', '/api/courses', null, cookie);
  console.log('After total:', after.data.total);
}

main().catch(console.error);
