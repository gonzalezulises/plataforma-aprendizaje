/**
 * Feature #37 Full Verification: Video feedback URLs are protected
 * Tests all verification steps:
 * 1. Get a video feedback URL
 * 2. Log out of the application
 * 3. Attempt to access the video URL directly
 * 4. Verify access is denied or requires authentication
 */

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
  console.log('==============================================');
  console.log('Feature #37 Verification: Video feedback URLs are protected');
  console.log('==============================================\n');

  let allPassed = true;
  const results = [];

  // Test data from setup
  const submissionId = 1;
  const feedbackId = 1;
  const studentId = 1;
  const instructorId = 2;

  // ===== STEP 1: Get a video feedback URL (as authenticated owner) =====
  console.log('STEP 1: Get a video feedback URL (as authenticated owner)');
  console.log('------------------------------------------------------');

  // Login as student (owner)
  const studentLogin = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'student@test.com',
    name: 'Test Student',
    role: 'student_free',
    userId: studentId
  });

  const studentCookie = studentLogin.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as student (ID:', studentLogin.data.user?.id + ')');

  // Get feedback with video URL
  const feedbackRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });

  console.log('  GET /api/feedback/submissions/' + submissionId + '/feedback');
  console.log('  Status:', feedbackRes.status);

  const videoFeedback = feedbackRes.data.feedback?.find(f => f.video_url);
  if (videoFeedback) {
    console.log('  Found video feedback (ID:', videoFeedback.id + ')');
    console.log('  Video URL:', videoFeedback.video_url);
    console.log('  video_url_protected flag:', videoFeedback.video_url_protected);
    results.push({ step: 1, test: 'Get video feedback URL as owner', passed: true });
  } else {
    console.log('  WARNING: No video feedback found');
    results.push({ step: 1, test: 'Get video feedback URL as owner', passed: false });
    allPassed = false;
  }

  // ===== STEP 2: Log out of the application =====
  console.log('\nSTEP 2: Log out of the application');
  console.log('-----------------------------------');
  // We'll just use a fresh request without cookies to simulate logged out

  // ===== STEP 3 & 4: Attempt to access video URL directly (unauthenticated) =====
  console.log('\nSTEP 3 & 4: Attempt to access video URL directly without authentication');
  console.log('-----------------------------------------------------------------------');

  // Test A: Access feedback endpoint without auth
  console.log('\nTest A: GET /api/feedback/submissions/' + submissionId + '/feedback (no auth)');
  const unauthFeedback = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'GET'
  });
  console.log('  Status:', unauthFeedback.status);
  console.log('  Response:', JSON.stringify(unauthFeedback.data));
  const testA = unauthFeedback.status === 401;
  console.log('  Expected: 401 Authentication required');
  console.log('  Result:', testA ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 3, test: 'Feedback endpoint requires auth', passed: testA });
  allPassed = allPassed && testA;

  // Test B: Access single feedback endpoint without auth
  console.log('\nTest B: GET /api/feedback/feedback/' + feedbackId + ' (no auth)');
  const unauthSingle = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/feedback/${feedbackId}`,
    method: 'GET'
  });
  console.log('  Status:', unauthSingle.status);
  console.log('  Response:', JSON.stringify(unauthSingle.data));
  const testB = unauthSingle.status === 401;
  console.log('  Expected: 401 Authentication required');
  console.log('  Result:', testB ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 3, test: 'Single feedback endpoint requires auth', passed: testB });
  allPassed = allPassed && testB;

  // Test C: Access protected video endpoint without auth
  console.log('\nTest C: GET /api/feedback/video/' + feedbackId + '/feature37-instructor-video.mp4 (no auth)');
  const unauthVideo = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/video/${feedbackId}/feature37-instructor-video.mp4`,
    method: 'GET'
  });
  console.log('  Status:', unauthVideo.status);
  console.log('  Response:', JSON.stringify(unauthVideo.data));
  const testC = unauthVideo.status === 401;
  console.log('  Expected: 401 Authentication required');
  console.log('  Result:', testC ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 4, test: 'Video endpoint requires auth', passed: testC });
  allPassed = allPassed && testC;

  // ===== Additional Security Tests =====
  console.log('\n===== ADDITIONAL SECURITY TESTS =====');

  // Test D: Non-owner cannot access feedback
  console.log('\nTest D: Non-owner cannot access video feedback');
  const otherLogin = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'other@test.com',
    name: 'Other User',
    role: 'student_free',
    userId: 999
  });
  const otherCookie = otherLogin.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as Other User (ID: 999)');

  const otherFeedback = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'GET',
    headers: { 'Cookie': otherCookie }
  });
  console.log('  Status:', otherFeedback.status);
  console.log('  Response:', JSON.stringify(otherFeedback.data));
  const testD = otherFeedback.status === 403;
  console.log('  Expected: 403 Access denied');
  console.log('  Result:', testD ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 'security', test: 'Non-owner denied access', passed: testD });
  allPassed = allPassed && testD;

  // Test E: Instructor CAN access feedback
  console.log('\nTest E: Course instructor can access video feedback');
  const instLogin = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'instructor@test.com',
    name: 'Test Instructor',
    role: 'instructor_admin',
    userId: instructorId
  });
  const instCookie = instLogin.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('  Logged in as Instructor (ID:', instructorId + ')');

  const instFeedback = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'GET',
    headers: { 'Cookie': instCookie }
  });
  console.log('  Status:', instFeedback.status);
  const testE = instFeedback.status === 200;
  console.log('  Expected: 200 OK with feedback data');
  console.log('  Result:', testE ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 'security', test: 'Instructor can access feedback', passed: testE });
  allPassed = allPassed && testE;

  // Test F: Owner CAN access feedback
  console.log('\nTest F: Submission owner can access video feedback');
  const ownerFeedback = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });
  console.log('  Status:', ownerFeedback.status);
  const testF = ownerFeedback.status === 200 && ownerFeedback.data.feedback?.length > 0;
  console.log('  Expected: 200 OK with feedback data');
  console.log('  Feedback count:', ownerFeedback.data.feedback?.length || 0);
  console.log('  Result:', testF ? 'PASS ✓' : 'FAIL ✗');
  results.push({ step: 'security', test: 'Owner can access feedback', passed: testF });
  allPassed = allPassed && testF;

  // ===== SUMMARY =====
  console.log('\n==============================================');
  console.log('VERIFICATION SUMMARY');
  console.log('==============================================');
  console.log('\nTest Results:');
  results.forEach(r => {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  [${status}] Step ${r.step}: ${r.test}`);
  });

  console.log('\n----------------------------------------------');
  console.log('OVERALL RESULT:', allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
  console.log('----------------------------------------------');

  if (allPassed) {
    console.log('\nFeature #37 VERIFIED:');
    console.log('✓ Video feedback URLs require authentication');
    console.log('✓ Unauthenticated users cannot access video feedback');
    console.log('✓ Non-owners are denied access to other users\' feedback');
    console.log('✓ Submission owners CAN access their feedback');
    console.log('✓ Course instructors CAN access feedback for their courses');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
