/**
 * Feature #37 Test Data Setup
 * Creates a submission with video feedback to test protection
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
  console.log('=== Setting up Feature #37 Test Data ===\n');

  // Step 1: Setup feature24 test data (creates instructors, courses, submissions)
  console.log('1. Running feature24 setup to create base test data...');
  const setup24 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/test/setup-feature24',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});

  console.log('   Status:', setup24.status);
  if (setup24.status === 200) {
    console.log('   Created/verified test data');
    console.log('   Instructor 1:', setup24.data.instructor?.name);
    console.log('   Instructor 2:', setup24.data.instructor2?.name);
    console.log('   Student:', setup24.data.student?.name);
  } else {
    console.log('   Error:', JSON.stringify(setup24.data));
  }

  // Step 2: Login as instructor
  console.log('\n2. Logging in as instructor...');
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

  const instCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('   Logged in');

  // Step 3: Get all submissions for instructor
  console.log('\n3. Getting instructor submissions...');
  const subsRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects/all/submissions',
    method: 'GET',
    headers: { 'Cookie': instCookie }
  });

  console.log('   Found', subsRes.data.submissions?.length || 0, 'submissions');

  if (subsRes.data.submissions?.length > 0) {
    const sub = subsRes.data.submissions[0];
    console.log('   Using submission ID:', sub.id, '- User ID:', sub.user_id);

    // Step 4: Create feedback with video_url
    console.log('\n4. Creating feedback with video_url...');
    const feedbackRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/feedback/submissions/${sub.id}/feedback`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': instCookie
      }
    }, {
      type: 'video',
      content: { notes: 'Feature #37 test video feedback' },
      scores: { overall: 90 },
      total_score: 90,
      max_score: 100,
      comment: 'Great work! Watch the video for detailed feedback.',
      video_url: '/api/uploads/file/feature37-test-video.mp4'
    });

    console.log('   Status:', feedbackRes.status);
    if (feedbackRes.status === 201) {
      console.log('   Created feedback with ID:', feedbackRes.data.feedback?.id);
      console.log('   Video URL:', feedbackRes.data.feedback?.video_url);

      // Store the feedback and submission info for testing
      console.log('\n=== TEST DATA READY ===');
      console.log('Submission ID:', sub.id);
      console.log('Submission Owner ID:', sub.user_id);
      console.log('Feedback ID:', feedbackRes.data.feedback?.id);
      console.log('Video URL:', feedbackRes.data.feedback?.video_url);
    } else {
      console.log('   Error:', JSON.stringify(feedbackRes.data));
    }
  } else {
    console.log('\n   No submissions found. Creating one...');

    // Get a project ID
    const projectsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/projects',
      method: 'GET',
      headers: { 'Cookie': instCookie }
    });

    console.log('   Projects:', projectsRes.data.projects?.length || 0);
  }
}

main().catch(console.error);
