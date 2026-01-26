// Test Feature #39: API returns appropriate error codes for authorization failures
const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== Feature #39: API Error Code Verification ===\n');

  const results = [];

  // Test 1: Unauthenticated request to protected endpoint (should be 401)
  console.log('--- Test 1: Unauthenticated request (expect 401) ---');
  const test1Endpoints = [
    { method: 'GET', path: '/api/analytics/dashboard', description: 'Analytics dashboard' },
    { method: 'GET', path: '/api/analytics/my-progress', description: 'My progress' },
    { method: 'GET', path: '/api/notifications', description: 'Notifications' },
    { method: 'GET', path: '/api/auth/me', description: 'Current user' },
  ];

  for (const ep of test1Endpoints) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: ep.path,
      method: ep.method,
      headers: { 'Content-Type': 'application/json' }
    });

    const pass = res.status === 401;
    results.push({ test: `Unauthenticated ${ep.description}`, expected: 401, actual: res.status, pass });
    console.log(`  ${ep.method} ${ep.path}: ${res.status} ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`    Response: ${JSON.stringify(res.body)}`);
  }

  // Login as student to get session cookie
  console.log('\n--- Logging in as student ---');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'student_free' });

  const cookies = loginRes.headers['set-cookie'];
  const sessionCookie = cookies ? cookies[0].split(';')[0] : '';
  console.log(`  Login status: ${loginRes.status}`);
  console.log(`  User: ${loginRes.body.user?.name} (${loginRes.body.user?.role})`);

  // Test 2: Authenticated student accessing instructor-only endpoints (should be 403)
  console.log('\n--- Test 2: Student accessing instructor-only endpoints (expect 403) ---');
  const test2Endpoints = [
    { method: 'GET', path: '/api/analytics/dashboard', description: 'Analytics dashboard' },
    { method: 'GET', path: '/api/analytics/student/1', description: 'View other student analytics' },
    { method: 'GET', path: '/api/analytics/export/1', description: 'Export course data' },
  ];

  for (const ep of test2Endpoints) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: ep.path,
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      }
    });

    const pass = res.status === 403;
    results.push({ test: `Student ${ep.description}`, expected: 403, actual: res.status, pass });
    console.log(`  ${ep.method} ${ep.path}: ${res.status} ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`    Response: ${JSON.stringify(res.body)}`);
  }

  // Test 3: Verify error messages are appropriate (not generic, helpful but not too specific)
  console.log('\n--- Test 3: Verify error messages are appropriate ---');

  // Unauthenticated error message
  const unauthRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/analytics/dashboard',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const unauthMsgOk = unauthRes.body.error &&
    (unauthRes.body.error.toLowerCase().includes('auth') ||
     unauthRes.body.error.toLowerCase().includes('required') ||
     unauthRes.body.error.toLowerCase().includes('autenticado'));
  results.push({ test: '401 message is appropriate', expected: 'mentions auth', actual: unauthRes.body.error, pass: unauthMsgOk });
  console.log(`  401 message: "${unauthRes.body.error}" - ${unauthMsgOk ? 'PASS' : 'FAIL'}`);

  // Forbidden error message
  const forbiddenRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/analytics/dashboard',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  });

  const forbiddenMsgOk = forbiddenRes.body.error &&
    (forbiddenRes.body.error.toLowerCase().includes('instructor') ||
     forbiddenRes.body.error.toLowerCase().includes('access') ||
     forbiddenRes.body.error.toLowerCase().includes('permission') ||
     forbiddenRes.body.error.toLowerCase().includes('acceso'));
  results.push({ test: '403 message is appropriate', expected: 'mentions permission/access', actual: forbiddenRes.body.error, pass: forbiddenMsgOk });
  console.log(`  403 message: "${forbiddenRes.body.error}" - ${forbiddenMsgOk ? 'PASS' : 'FAIL'}`);

  // Test 4: Verify no sensitive info in error responses
  console.log('\n--- Test 4: Verify no sensitive info in error responses ---');

  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /session/i,
    // Note: "Internal Server Error" is OK - it's a standard HTTP error message, not sensitive info
    // We look for stack traces and specific file paths instead
    /stack/i,
    /at\s+\w+\s+\(/,  // Stack trace pattern
    /node_modules/i,
    /\.js:\d+/,  // File:line pattern
    /Error:\s+\w+\s+at/i,  // Error with stack trace
  ];

  const errorResponses = [
    { name: '401 response', body: unauthRes.body },
    { name: '403 response', body: forbiddenRes.body },
  ];

  for (const errResp of errorResponses) {
    const bodyStr = JSON.stringify(errResp.body);
    const hasSensitive = sensitivePatterns.some(p => p.test(bodyStr));
    results.push({ test: `${errResp.name} has no sensitive info`, expected: 'no sensitive info', actual: hasSensitive ? 'has sensitive info' : 'clean', pass: !hasSensitive });
    console.log(`  ${errResp.name}: ${!hasSensitive ? 'PASS (no sensitive info)' : 'FAIL (sensitive info found)'}`);
    if (hasSensitive) {
      console.log(`    Body: ${bodyStr}`);
    }
  }

  // Test 500 error response for sensitive info
  const error500Res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/test/error-500',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const error500Str = JSON.stringify(error500Res.body);
  const has500Sensitive = sensitivePatterns.some(p => p.test(error500Str));
  results.push({ test: '500 response has no sensitive info', expected: 'no sensitive info', actual: has500Sensitive ? 'has sensitive info' : 'clean', pass: !has500Sensitive });
  console.log(`  500 response: ${!has500Sensitive ? 'PASS (no sensitive info)' : 'FAIL (sensitive info found)'}`);
  console.log(`    Body: ${error500Str}`);

  // Summary
  console.log('\n=== SUMMARY ===');
  const passing = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`Passed: ${passing}/${total}`);

  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}: ${r.test} (expected: ${r.expected}, actual: ${r.actual})`);
  }

  const allPass = passing === total;
  console.log(`\nOverall: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  return allPass;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
