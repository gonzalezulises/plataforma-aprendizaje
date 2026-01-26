/**
 * Feature #37 Full Test: Video feedback URLs are protected
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';

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
  console.log('=== Feature #37 Full Verification ===');
  console.log('Video feedback URLs are protected\n');

  let allPassed = true;

  // Test 1: Unauthenticated access to feedback endpoint should fail
  console.log('TEST 1: Unauthenticated access to GET /feedback/submissions/:id/feedback');
  const test1 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/submissions/1/feedback',
    method: 'GET'
  });
  console.log('  Status:', test1.status);
  console.log('  Response:', JSON.stringify(test1.data));
  const test1Pass = test1.status === 401 && test1.data.error === 'Authentication required';
  console.log('  Result:', test1Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test1Pass;

  // Test 2: Unauthenticated access to single feedback endpoint should fail
  console.log('\nTEST 2: Unauthenticated access to GET /feedback/:id');
  const test2 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/feedback/1',
    method: 'GET'
  });
  console.log('  Status:', test2.status);
  console.log('  Response:', JSON.stringify(test2.data));
  const test2Pass = test2.status === 401 && test2.data.error === 'Authentication required';
  console.log('  Result:', test2Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test2Pass;

  // Test 3: Unauthenticated access to video endpoint should fail
  console.log('\nTEST 3: Unauthenticated access to GET /feedback/video/:feedbackId/:filename');
  const test3 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/video/1/test-video.mp4',
    method: 'GET'
  });
  console.log('  Status:', test3.status);
  console.log('  Response:', JSON.stringify(test3.data));
  const test3Pass = test3.status === 401 && test3.data.error === 'Authentication required';
  console.log('  Result:', test3Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test3Pass;

  // Test 4: Login as student who owns submission 1
  console.log('\nTEST 4: Authenticated access as submission owner');

  // First login as Test Student (user_id=1)
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'student@test.com',
    name: 'Test Student',
    role: 'student_free',
    id: 1
  });

  const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as Test Student (ID: 1)');

  // Now access feedback as owner
  const test4 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/submissions/1/feedback',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('  Status:', test4.status);
  const test4Pass = test4.status === 200;
  console.log('  Feedback count:', test4.data.feedback?.length || 0);
  console.log('  Result:', test4Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test4Pass;

  // Test 5: Login as a DIFFERENT user and try to access submission 1's feedback
  console.log('\nTEST 5: Authenticated access as NON-owner should be denied');

  const login2Res = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'other@test.com',
    name: 'Other User',
    role: 'student_free',
    id: 999
  });

  const cookie2 = login2Res.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as Other User (ID: 999)');

  const test5 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/submissions/1/feedback',
    method: 'GET',
    headers: { 'Cookie': cookie2 }
  });
  console.log('  Status:', test5.status);
  console.log('  Response:', JSON.stringify(test5.data));
  const test5Pass = test5.status === 403;
  console.log('  Expected: 403 Access denied');
  console.log('  Result:', test5Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test5Pass;

  // Test 6: Instructor CAN access any submission's feedback
  console.log('\nTEST 6: Instructor can access any feedback');

  const login3Res = await makeRequest({
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

  const cookie3 = login3Res.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as Instructor (ID: 2)');

  const test6 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/submissions/1/feedback',
    method: 'GET',
    headers: { 'Cookie': cookie3 }
  });
  console.log('  Status:', test6.status);
  const test6Pass = test6.status === 200;
  console.log('  Feedback count:', test6.data.feedback?.length || 0);
  console.log('  Result:', test6Pass ? 'PASS ✓' : 'FAIL ✗');
  allPassed = allPassed && test6Pass;

  console.log('\n=== SUMMARY ===');
  console.log('All tests passed:', allPassed ? 'YES ✓' : 'NO ✗');

  if (allPassed) {
    console.log('\nFeature #37 VERIFIED:');
    console.log('1. Unauthenticated users cannot access video feedback URLs');
    console.log('2. Non-owners cannot access other users\' feedback');
    console.log('3. Submission owners CAN access their feedback');
    console.log('4. Instructors CAN access feedback for their courses');
  }
}

main().catch(console.error);
