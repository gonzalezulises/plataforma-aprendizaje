const http = require('http');

// Cookie jar - stores key=value pairs
let cookieJar = {};

function getCookieString() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    // Add cookies to headers
    if (Object.keys(cookieJar).length > 0) {
      options.headers = options.headers || {};
      options.headers['Cookie'] = getCookieString();
    }

    const req = http.request(options, (res) => {
      let body = '';

      // Capture cookies
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        setCookies.forEach(cookie => {
          const match = cookie.match(/^([^=]+)=([^;]+)/);
          if (match) {
            cookieJar[match[1]] = match[2];
          }
        });
      }

      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Step 1: Login as user 1...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ userId: 1 }));
  console.log('Login:', loginRes.status, loginRes.body);

  console.log('\nStep 2: Get CSRF token...');
  const csrfRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/csrf-token',
    method: 'GET',
    headers: {}
  });
  console.log('CSRF Response:', csrfRes.body);
  const csrfToken = csrfRes.body.csrfToken || csrfRes.body.token || 'dummy';
  console.log('CSRF Token:', csrfToken);

  console.log('\nStep 3: Update career path to single course...');
  const updateRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/career-paths/python-developer/update-courses',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    }
  }, JSON.stringify({ course_ids: [1] }));
  console.log('Update career path:', updateRes.status, updateRes.body?.message || updateRes.body);

  console.log('\nStep 4: Enroll in course 1...');
  const enrollRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/courses/python-fundamentos/enroll',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    }
  });
  console.log('Enroll result:', enrollRes.status, enrollRes.body?.message || enrollRes.body?.error || enrollRes.body);

  console.log('\nStep 5: Start career path...');
  const startRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/career-paths/python-developer/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    }
  });
  console.log('Start result:', startRes.status, startRes.body?.message || startRes.body?.error || startRes.body);

  console.log('\nStep 6: Complete course in career path...');
  const completeRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/career-paths/python-developer/complete-course',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    }
  }, JSON.stringify({ course_id: 1 }));
  console.log('Complete result:', completeRes.status, completeRes.body);

  if (completeRes.body.badge) {
    console.log('\n*** BADGE EARNED! ***');
    console.log('Badge:', completeRes.body.badge);
  }

  console.log('\nStep 7: Check badges...');
  const badgesRes = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/career-paths/user/badges',
    method: 'GET',
    headers: {}
  });
  console.log('Badges:', JSON.stringify(badgesRes.body, null, 2));
}

main().catch(console.error);
