/**
 * Feature #37: Create complete test data (with CSRF handling)
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
  console.log('=== Creating Feature #37 Test Data ===\n');

  // Step 1: Login as student and get CSRF token
  console.log('1. Logging in as student...');
  const studentLogin = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'feature37student@test.com',
    name: 'Feature 37 Student',
    role: 'student_free'
  });

  const studentCookie = studentLogin.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('   Student ID:', studentLogin.data.user?.id);

  // Get CSRF token
  const csrfRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/csrf-token',
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });
  console.log('   CSRF response:', csrfRes.status);
  const csrfToken = csrfRes.data.csrfToken || csrfRes.data.token || '';
  console.log('   CSRF token obtained:', csrfToken ? 'yes' : 'no');

  // Step 2: Get projects
  console.log('\n2. Getting available projects...');
  const projectsRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects',
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });

  const projects = projectsRes.data.projects || [];
  console.log('   Found', projects.length, 'projects');

  if (projects.length === 0) {
    console.log('   No projects available. Need to create one first.');
    return;
  }

  // Find project 1 (owned by instructor 2)
  const project = projects.find(p => p.id === 1) || projects[0];
  console.log('   Using project:', project.title, '(ID:', project.id, ', course_id:', project.course_id + ')');

  // Step 3: Submit to the project (without CSRF for GET-like submission check)
  console.log('\n3. Checking/Creating submission for the project...');

  // First check if submission exists
  const checkSubRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/projects/${project.id}/submissions`,
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });

  let submission;
  const existingSubs = checkSubRes.data.submissions || [];
  const mySub = existingSubs.find(s => String(s.user_id) === String(studentLogin.data.user?.id));

  if (mySub) {
    console.log('   Found existing submission ID:', mySub.id);
    submission = mySub;
  } else {
    // Need to create submission
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': studentCookie
    };
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    const submitRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${project.id}/submit`,
      method: 'POST',
      headers: headers
    }, {
      content: 'Feature #37 test submission content - Video feedback URL protection test',
      github_url: 'https://github.com/test/feature37-video'
    });

    console.log('   Submit status:', submitRes.status);
    if (submitRes.status === 201 || submitRes.status === 200) {
      submission = submitRes.data.submission;
      console.log('   Created submission ID:', submission?.id);
    } else {
      console.log('   Error:', JSON.stringify(submitRes.data));
      return;
    }
  }

  if (!submission) {
    console.log('   Could not get or create submission');
    return;
  }

  // Get course info to find instructor
  console.log('\n4. Getting course info...');
  const courseInfoRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/courses/${project.course_id}`,
    method: 'GET',
    headers: { 'Cookie': studentCookie }
  });
  console.log('   Course instructor_id:', courseInfoRes.data.course?.instructor_id);

  // Step 4: Login as the course's instructor
  const instructorId = courseInfoRes.data.course?.instructor_id || 2;
  console.log('\n5. Logging in as course instructor (ID: ' + instructorId + ')...');
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
  console.log('   Instructor ID:', instLogin.data.user?.id);

  // Get instructor CSRF token
  const instCsrfRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/csrf-token',
    method: 'GET',
    headers: { 'Cookie': instCookie }
  });
  const instCsrfToken = instCsrfRes.data.csrfToken || instCsrfRes.data.token || '';

  // Step 6: Add video feedback
  console.log('\n6. Creating video feedback...');
  const feedbackHeaders = {
    'Content-Type': 'application/json',
    'Cookie': instCookie
  };
  if (instCsrfToken) {
    feedbackHeaders['x-csrf-token'] = instCsrfToken;
  }

  const feedbackRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/feedback/submissions/${submission.id}/feedback`,
    method: 'POST',
    headers: feedbackHeaders
  }, {
    type: 'video',
    content: { notes: 'Feature #37 video feedback test' },
    scores: { overall: 85 },
    total_score: 85,
    max_score: 100,
    comment: 'Great work! Watch the video for detailed feedback on your submission.',
    video_url: '/api/uploads/file/feature37-instructor-video.mp4'
  });

  console.log('   Feedback status:', feedbackRes.status);
  if (feedbackRes.status === 201) {
    console.log('   Created feedback ID:', feedbackRes.data.feedback?.id);

    console.log('\n=== TEST DATA CREATED ===');
    console.log('Student ID:', studentLogin.data.user?.id);
    console.log('Submission ID:', submission.id);
    console.log('Feedback ID:', feedbackRes.data.feedback?.id);
    console.log('Video URL:', feedbackRes.data.feedback?.video_url);
    console.log('\nReady to test Feature #37!');
  } else {
    console.log('   Error:', JSON.stringify(feedbackRes.data));
  }
}

main().catch(console.error);
