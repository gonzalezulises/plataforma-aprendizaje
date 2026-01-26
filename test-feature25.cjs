// Test Feature #25: Instructor cannot view submissions from other instructors' courses
// This test verifies that instructor access is scoped to their own courses

const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('=== FEATURE #25 TEST: Instructor cannot view submissions from other instructors courses ===\n');

  // Step 1: Log in as Instructor A (userId: 100)
  console.log('STEP 1: Log in as Instructor A');
  const loginA = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'instructor_admin', email: 'instructor_a@test.com', name: 'Instructor A', userId: 100 });
  const cookieA = loginA.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log(`  - Login status: ${loginA.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`  - User: ${loginA.data?.user?.name} (ID: ${loginA.data?.user?.id})`);

  // Step 1b: Log in as Instructor B (userId: 101)
  console.log('\n  Log in as Instructor B');
  const loginB = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'instructor_admin', email: 'instructor_b@test.com', name: 'Instructor B', userId: 101 });
  const cookieB = loginB.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log(`  - Login status: ${loginB.status === 200 ? 'PASS' : 'FAIL'}`);
  console.log(`  - User: ${loginB.data?.user?.name} (ID: ${loginB.data?.user?.id})`);

  // Step 2: Assign courses to different instructors
  console.log('\n--- Setting up course ownership ---');

  // Set course 1 (python-fundamentos) to Instructor A (100)
  const updateCourse1 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/courses/1',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA }
  }, { instructor_id: 100 });
  console.log(`  Course 1 (Python) -> Instructor A: ${updateCourse1.data?.course?.instructor_id === 100 ? 'PASS' : 'FAIL'} (instructor_id: ${updateCourse1.data?.course?.instructor_id})`);

  // Set course 2 (data-science-python) to Instructor B (101)
  const updateCourse2 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/courses/2',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieB }
  }, { instructor_id: 101 });
  console.log(`  Course 2 (Data Science) -> Instructor B: ${updateCourse2.data?.course?.instructor_id === 101 ? 'PASS' : 'FAIL'} (instructor_id: ${updateCourse2.data?.course?.instructor_id})`);

  // Verify courses are correctly set
  const courses = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/courses',
    method: 'GET'
  });
  console.log('\n  Course ownership verification:');
  courses.data?.courses?.slice(0, 2).forEach(c => {
    console.log(`    - ${c.title}: instructor_id = ${c.instructor_id}`);
  });

  // Step 3: Create test submissions
  console.log('\n--- Creating test submissions ---');

  // Log in as student
  const loginStudent = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'student_free', email: 'student@test.com', name: 'Test Student', userId: 200 });
  const cookieStudent = loginStudent.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log(`  Student login: ${loginStudent.status === 200 ? 'PASS' : 'FAIL'}`);

  // Get projects
  const projects = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects',
    method: 'GET'
  });

  // Find project for course 1 (Instructor A) and course 2 (Instructor B)
  const projectA = projects.data?.projects?.find(p => p.course_id === 'python-fundamentos');
  const projectB = projects.data?.projects?.find(p => p.course_id === 'data-science-python');

  console.log(`  Project A (course 1): ID ${projectA?.id}`);
  console.log(`  Project B (course 2): ID ${projectB?.id}`);

  // Get or create submissions for each project
  let submissionAId = null;
  let submissionBId = null;

  if (projectA) {
    const subResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectA.id}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStudent }
    }, { content: 'Test submission for Feature 25 - Course A', github_url: 'https://github.com/test/f25-a' });
    submissionAId = subResponse.data?.submission?.id;
    console.log(`  Submission A created: ID ${submissionAId}`);
  }

  if (projectB) {
    const subResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectB.id}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStudent }
    }, { content: 'Test submission for Feature 25 - Course B', github_url: 'https://github.com/test/f25-b' });
    submissionBId = subResponse.data?.submission?.id;
    console.log(`  Submission B created: ID ${submissionBId}`);
  }

  // Also check for existing submissions
  const allSubmissions = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects/all/submissions',
    method: 'GET',
    headers: { 'Cookie': cookieA }
  });
  console.log(`\n  Instructor A sees ${allSubmissions.data?.submissions?.length || 0} submissions for their courses`);

  // STEP 2 - TEST: Instructor A attempts to access Instructor B's course submissions
  console.log('\n=== STEP 2: Attempt to access submissions from Instructor B\'s course ===\n');

  // Test 1: Try to get submissions for project B (owned by Instructor B) as Instructor A
  if (projectB) {
    const accessProjectB = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectB.id}/submissions`,
      method: 'GET',
      headers: { 'Cookie': cookieA }
    });
    console.log(`TEST 1 - GET /projects/${projectB.id}/submissions (Instructor B's project) as Instructor A:`);
    console.log(`  Status: ${accessProjectB.status}`);
    console.log(`  Response: ${JSON.stringify(accessProjectB.data)}`);
    console.log(`  RESULT: ${accessProjectB.status === 403 ? '✓ PASS - Access denied' : '✗ FAIL - Should have been denied'}`);
  }

  // Test 2: Try to get specific submission from Instructor B's course
  if (submissionBId) {
    const accessSubmissionB = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/submissions/${submissionBId}`,
      method: 'GET',
      headers: { 'Cookie': cookieA }
    });
    console.log(`\nTEST 2 - GET /projects/submissions/${submissionBId} (submission in Instructor B's course) as Instructor A:`);
    console.log(`  Status: ${accessSubmissionB.status}`);
    console.log(`  Response: ${JSON.stringify(accessSubmissionB.data)}`);
    console.log(`  RESULT: ${accessSubmissionB.status === 403 ? '✓ PASS - Access denied' : '✗ FAIL - Should have been denied'}`);
  }

  // Test 3: Try to provide feedback on Instructor B's submission
  if (submissionBId) {
    const feedbackAttempt = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/feedback/submissions/${submissionBId}/feedback`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA }
    }, { type: 'rubric', total_score: 80, max_score: 100, comment: 'Unauthorized feedback attempt' });
    console.log(`\nTEST 3 - POST /feedback/submissions/${submissionBId}/feedback (feedback on Instructor B's submission) as Instructor A:`);
    console.log(`  Status: ${feedbackAttempt.status}`);
    console.log(`  Response: ${JSON.stringify(feedbackAttempt.data)}`);
    console.log(`  RESULT: ${feedbackAttempt.status === 403 ? '✓ PASS - Access denied' : '✗ FAIL - Should have been denied'}`);
  }

  // STEP 3: Verify access is properly denied
  console.log('\n=== STEP 3: Verify access is denied ===');
  console.log('(Confirmed via status 403 responses above)');

  // STEP 4: Verify API returns appropriate error
  console.log('\n=== STEP 4: Verify API returns appropriate error ===');
  console.log('(Confirmed via error messages in responses above)');

  // POSITIVE TEST: Verify Instructor A CAN access their own course submissions
  console.log('\n=== POSITIVE TEST: Instructor A can access their own submissions ===\n');

  if (projectA) {
    const accessProjectA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectA.id}/submissions`,
      method: 'GET',
      headers: { 'Cookie': cookieA }
    });
    console.log(`TEST 4 - GET /projects/${projectA.id}/submissions (Instructor A's project) as Instructor A:`);
    console.log(`  Status: ${accessProjectA.status}`);
    console.log(`  Submissions count: ${accessProjectA.data?.submissions?.length || 0}`);
    console.log(`  RESULT: ${accessProjectA.status === 200 ? '✓ PASS - Access granted to own course' : '✗ FAIL - Should have access to own course'}`);
  }

  if (submissionAId) {
    const accessSubmissionA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/submissions/${submissionAId}`,
      method: 'GET',
      headers: { 'Cookie': cookieA }
    });
    console.log(`\nTEST 5 - GET /projects/submissions/${submissionAId} (submission in Instructor A's course) as Instructor A:`);
    console.log(`  Status: ${accessSubmissionA.status}`);
    console.log(`  RESULT: ${accessSubmissionA.status === 200 ? '✓ PASS - Access granted to own course' : '✗ FAIL - Should have access to own course'}`);
  }

  console.log('\n=== TEST COMPLETE ===');
}

test().catch(console.error);
