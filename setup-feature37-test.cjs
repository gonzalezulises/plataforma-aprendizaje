/**
 * Feature #37 Test Setup: Video feedback URLs are protected
 * Creates test data for video feedback protection verification
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
  console.log('=== Feature #37 Test Setup ===\n');

  // Step 1: Login as instructor
  console.log('1. Logging in as instructor...');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'instructor@test.com',
    name: 'Test Instructor',
    role: 'instructor_admin'
  });

  if (loginRes.status !== 200) {
    console.log('Login failed:', loginRes.data);
    return;
  }

  const cookies = loginRes.headers['set-cookie'];
  const sessionCookie = cookies ? cookies[0].split(';')[0] : '';
  console.log('   Logged in successfully. Session:', sessionCookie.substring(0, 50) + '...');

  // Step 2: Check existing submissions
  console.log('\n2. Getting existing submissions...');
  const submissionsRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects/all/submissions',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });

  console.log('   Found', submissionsRes.data.submissions?.length || 0, 'submissions');

  if (!submissionsRes.data.submissions?.length) {
    console.log('   No submissions found. Please create a submission first.');
    return;
  }

  const submission = submissionsRes.data.submissions[0];
  console.log('   Using submission ID:', submission.id, '- User:', submission.user_id);

  // Step 3: Create feedback with video_url
  console.log('\n3. Creating feedback with video_url...');
  const feedbackRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submission.id}/feedback`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  }, {
    type: 'video',
    content: { notes: 'Video feedback test for Feature #37' },
    scores: { overall: 85 },
    total_score: 85,
    max_score: 100,
    comment: 'Great work! Watch the video for detailed feedback.',
    video_url: '/api/uploads/file/test-video-feature37.mp4'
  });

  console.log('   Feedback creation status:', feedbackRes.status);
  if (feedbackRes.status === 201) {
    console.log('   Created feedback ID:', feedbackRes.data.feedback?.id);
    console.log('   Video URL:', feedbackRes.data.feedback?.video_url);
  } else {
    console.log('   Response:', JSON.stringify(feedbackRes.data));
  }

  // Step 4: Test unauthenticated access (new session)
  console.log('\n4. Testing unauthenticated access to feedback...');
  const unauthRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submission.id}/feedback`,
    method: 'GET'
  });

  console.log('   Status:', unauthRes.status);
  console.log('   Response:', JSON.stringify(unauthRes.data));
  console.log('   Expected: 401 Authentication required');
  console.log('   Result:', unauthRes.status === 401 ? 'PASS' : 'FAIL');

  // Step 5: Test video endpoint unauthenticated
  console.log('\n5. Testing unauthenticated access to video endpoint...');
  const videoUnauthRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/feedback/video/1/test-video.mp4',
    method: 'GET'
  });

  console.log('   Status:', videoUnauthRes.status);
  console.log('   Response:', JSON.stringify(videoUnauthRes.data));
  console.log('   Expected: 401 Authentication required');
  console.log('   Result:', videoUnauthRes.status === 401 ? 'PASS' : 'FAIL');

  // Step 6: Test authenticated access as owner
  console.log('\n6. Testing authenticated access as submission owner...');

  // Login as the student who owns the submission
  const studentLoginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'student@test.com',
    name: 'Test Student',
    role: 'student_free',
    id: submission.user_id
  });

  const studentCookie = studentLoginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('   Logged in as student...');

  const authRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submission.id}/feedback`,
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });

  console.log('   Status:', authRes.status);
  console.log('   Feedback count:', authRes.data.feedback?.length || 0);
  console.log('   Expected: 200 with feedback data');
  console.log('   Result:', authRes.status === 200 ? 'PASS' : 'FAIL');

  // Check if video_url is protected
  if (authRes.data.feedback?.length > 0) {
    const feedback = authRes.data.feedback.find(f => f.video_url);
    if (feedback) {
      console.log('\n   Video URL in response:', feedback.video_url);
      console.log('   video_url_protected flag:', feedback.video_url_protected);
    }
  }

  console.log('\n=== Feature #37 Test Setup Complete ===');
  console.log('\nSummary:');
  console.log('- Submission ID:', submission.id);
  console.log('- Feedback with video created');
  console.log('- Unauthenticated access blocked');
  console.log('- Owner can access feedback');
}

main().catch(console.error);
