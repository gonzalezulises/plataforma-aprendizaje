// Setup script for Feature #25 test
// Creates two instructors, assigns courses to them, and creates test submissions

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

async function setup() {
  console.log('Setting up Feature #25 test data...\n');

  // 1. Log in as Instructor A (userId: 100)
  const loginA = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'instructor_admin', email: 'instructor_a@test.com', name: 'Instructor A', userId: 100 });

  const cookieA = loginA.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Instructor A login:', loginA.status === 200 ? 'OK' : 'FAILED');

  // 2. Log in as Instructor B (userId: 101)
  const loginB = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'instructor_admin', email: 'instructor_b@test.com', name: 'Instructor B', userId: 101 });

  const cookieB = loginB.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Instructor B login:', loginB.status === 200 ? 'OK' : 'FAILED');

  // 3. Create a project for Instructor A's course (course 1 = python-fundamentos)
  // First, set instructor_id on the course via a direct DB update endpoint or assume it's set

  // 4. Create a project for course 1 (will be assigned to Instructor A)
  const projectA = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieA }
  }, { course_id: 'python-fundamentos', title: 'Feature 25 Test Project - Instructor A', description: 'Test project for Feature 25' });

  console.log('Project for Instructor A:', projectA.status === 201 ? `Created (ID: ${projectA.data?.project?.id})` : 'FAILED or already exists');
  const projectIdA = projectA.data?.project?.id;

  // 5. Create a project for course 2 (will be assigned to Instructor B)
  const projectB = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieB }
  }, { course_id: 'data-science-python', title: 'Feature 25 Test Project - Instructor B', description: 'Test project for Feature 25' });

  console.log('Project for Instructor B:', projectB.status === 201 ? `Created (ID: ${projectB.data?.project?.id})` : 'FAILED or already exists');
  const projectIdB = projectB.data?.project?.id;

  // 6. Log in as a student and submit to both projects
  const loginStudent = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/dev-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { role: 'student_free', email: 'student@test.com', name: 'Test Student', userId: 200 });

  const cookieStudent = loginStudent.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('Student login:', loginStudent.status === 200 ? 'OK' : 'FAILED');

  // Submit to project A
  if (projectIdA) {
    const submissionA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectIdA}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStudent }
    }, { content: 'Test submission for Instructor A project', github_url: 'https://github.com/test/repo-a' });

    console.log('Submission to Project A:', submissionA.status === 201 ? `Created (ID: ${submissionA.data?.submission?.id})` : 'FAILED or already exists');
    console.log('  Submission A ID:', submissionA.data?.submission?.id);
  }

  // Submit to project B
  if (projectIdB) {
    const submissionB = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectIdB}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStudent }
    }, { content: 'Test submission for Instructor B project', github_url: 'https://github.com/test/repo-b' });

    console.log('Submission to Project B:', submissionB.status === 201 ? `Created (ID: ${submissionB.data?.submission?.id})` : 'FAILED or already exists');
    console.log('  Submission B ID:', submissionB.data?.submission?.id);
  }

  console.log('\n--- Current state ---');

  // List all projects
  const projects = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/projects',
    method: 'GET',
    headers: { 'Cookie': cookieA }
  });
  console.log('All projects:', JSON.stringify(projects.data?.projects, null, 2));

  // Get submissions for project A (as Instructor A - should work)
  if (projectIdA) {
    const subsA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/projects/${projectIdA}/submissions`,
      method: 'GET',
      headers: { 'Cookie': cookieA }
    });
    console.log('\nSubmissions for Project A (as Instructor A):', subsA.status, JSON.stringify(subsA.data));
  }

  console.log('\n--- Saving test info ---');
  console.log('Cookie A:', cookieA);
  console.log('Cookie B:', cookieB);
  console.log('Cookie Student:', cookieStudent);
}

setup().catch(console.error);
