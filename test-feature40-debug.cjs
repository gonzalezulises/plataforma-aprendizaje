/**
 * Debug test for Feature #40
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let sessionCookie = '';
let csrfToken = '';

function makeRequest(method, path, data = null, includeCsrf = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      }
    };

    if (includeCsrf && csrfToken) {
      options.headers['x-csrf-token'] = csrfToken;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function debug() {
  console.log('=== Debug Test ===\n');

  // Step 1: Login
  console.log('1. Login as instructor...');
  const login = await makeRequest('POST', '/api/auth/dev-login', {
    role: 'instructor_admin',
    name: 'Test Instructor',
    email: 'test-instructor@example.com',
    userId: 99
  });
  console.log('   Status:', login.status);
  console.log('   Response:', JSON.stringify(login.data, null, 2));

  // Step 2: Get CSRF token
  console.log('\n2. Get CSRF token...');
  const csrfResponse = await makeRequest('GET', '/api/csrf-token');
  console.log('   Status:', csrfResponse.status);
  console.log('   Response:', JSON.stringify(csrfResponse.data, null, 2));
  csrfToken = csrfResponse.data.csrfToken;
  console.log('   Token:', csrfToken);

  // Step 3: Update profile
  console.log('\n3. Update profile...');
  const profile = await makeRequest('PUT', '/api/users/me', {
    bio: 'Test bio',
    name: 'Updated Name'
  }, true);
  console.log('   Status:', profile.status);
  console.log('   Response:', JSON.stringify(profile.data, null, 2));

  // Step 4: Create course
  console.log('\n4. Create course...');
  const course = await makeRequest('POST', '/api/courses', {
    title: 'Test Audit Course ' + Date.now(),
    description: 'Test',
    category: 'Testing'
  }, true);
  console.log('   Status:', course.status);
  console.log('   Response:', JSON.stringify(course.data, null, 2));

  // If course created, delete it
  if (course.status === 201 && course.data.course) {
    console.log('\n5. Delete course...');
    const del = await makeRequest('DELETE', '/api/courses/' + course.data.course.id, null, true);
    console.log('   Status:', del.status);
    console.log('   Response:', JSON.stringify(del.data, null, 2));
  }
}

debug().catch(console.error);
