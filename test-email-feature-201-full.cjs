// Full test script for Feature #201: Email notification for new feedback
// 1. Login as student, submit project
// 2. Login as instructor, provide feedback
// 3. Verify email notification is sent
const http = require('http');

const PORT = 3001;

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      const cookies = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: body,
          cookie: cookies ? cookies[0].split(';')[0] : null
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function login(email, password) {
  const data = JSON.stringify({ email, password });
  const result = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/direct-auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, data);
  console.log(`[Login ${email}] Status: ${result.status}`);
  return result.cookie;
}

async function submitProject(cookie, projectId) {
  const data = JSON.stringify({
    content: 'TEST_EMAIL_FEATURE_201: This is a test submission to verify email notification.',
    github_url: 'https://github.com/test/feature201'
  });
  const result = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/projects/${projectId}/submit`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Cookie': cookie }
  }, data);
  console.log(`[Submit] Status: ${result.status}`);
  console.log(`[Submit] Response: ${result.body.substring(0, 300)}`);

  // Extract submission ID from response
  try {
    const parsed = JSON.parse(result.body);
    return parsed.submission?.id || parsed.id;
  } catch (e) {
    return null;
  }
}

async function createFeedback(cookie, submissionId) {
  const data = JSON.stringify({
    type: 'rubric',
    total_score: 95,
    max_score: 100,
    comment: 'TEST_EMAIL_201: Outstanding work! This submission demonstrates excellent understanding.',
    scores: { code_quality: 24, functionality: 25, documentation: 23, creativity: 23 }
  });
  const result = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: `/api/feedback/submissions/${submissionId}/feedback`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Cookie': cookie }
  }, data);
  console.log(`[Feedback] Status: ${result.status}`);
  console.log(`[Feedback] Response: ${result.body.substring(0, 300)}`);
  return result.status === 201;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Feature #201: Full Email Notification Test');
  console.log('='.repeat(70));

  try {
    // Step 1: Login as student
    console.log('\n--- Step 1: Student Login ---');
    const studentCookie = await login('testuser@example.com', 'password123');
    if (!studentCookie) throw new Error('Student login failed');

    // Step 2: Submit a project
    console.log('\n--- Step 2: Submit Project ---');
    const submissionId = await submitProject(studentCookie, 1);
    console.log(`[Submit] Submission ID: ${submissionId}`);
    if (!submissionId) throw new Error('Failed to get submission ID');

    // Step 3: Login as instructor
    console.log('\n--- Step 3: Instructor Login ---');
    const instructorCookie = await login('instructor@test.com', 'password123');
    if (!instructorCookie) throw new Error('Instructor login failed');

    // Step 4: Provide feedback (this should trigger email notification)
    console.log('\n--- Step 4: Create Feedback ---');
    const success = await createFeedback(instructorCookie, submissionId);

    console.log('\n' + '='.repeat(70));
    if (success) {
      console.log('SUCCESS! Feedback created.');
      console.log('Now check backend-4002.log for EMAIL NOTIFICATION output.');
      console.log('Look for "[EMAIL SERVICE]" in the log.');
    } else {
      console.log('FAILED: Could not create feedback.');
    }
    console.log('='.repeat(70));
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

main();
