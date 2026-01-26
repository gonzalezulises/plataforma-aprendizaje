/**
 * Feature #40: Verify audit trail entries
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let sessionCookie = '';
let csrfToken = '';

function makeRequest(method, path, data = null, includeCsrf = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      }
    };

    if (includeCsrf && csrfToken) {
      options.headers['x-csrf-token'] = csrfToken;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function verify() {
  console.log('=== Feature #40 Audit Trail Verification ===\n');

  // Step 1: Login as instructor
  console.log('1. Login as instructor...');
  const login = await makeRequest('POST', '/api/auth/dev-login', {
    role: 'instructor_admin',
    name: 'Audit Tester',
    email: 'audit-tester@example.com',
    userId: 99
  });
  console.log('   Status:', login.status);

  // Step 2: Get CSRF token
  const csrf = await makeRequest('GET', '/api/csrf-token');
  csrfToken = csrf.data.csrfToken;
  console.log('   CSRF:', csrfToken ? 'OK' : 'FAILED');

  // Step 3: Create a course (triggers audit:course_created)
  console.log('\n2. Creating course (triggers audit:course_created)...');
  const createCourse = await makeRequest('POST', '/api/courses', {
    title: 'Verify Audit Course ' + Date.now(),
    description: 'Test',
    category: 'Testing'
  }, true);
  console.log('   Course created:', createCourse.status === 201 ? 'SUCCESS' : 'FAILED');
  const courseId = createCourse.data?.course?.id;

  // Step 4: Delete the course (triggers audit:course_deleted)
  if (courseId) {
    console.log('\n3. Deleting course (triggers audit:course_deleted)...');
    const deleteCourse = await makeRequest('DELETE', '/api/courses/' + courseId, null, true);
    console.log('   Course deleted:', deleteCourse.status === 200 ? 'SUCCESS' : 'FAILED');
  }

  // Step 5: Check audit trail
  console.log('\n4. Fetching audit trail...');
  const auditTrail = await makeRequest('GET', '/api/analytics/audit-trail?limit=20');
  console.log('   Status:', auditTrail.status);

  if (auditTrail.status === 200 && auditTrail.data.success) {
    console.log('   Total audit events found:', auditTrail.data.count);
    console.log('\n   Recent audit events:');
    auditTrail.data.events.forEach((event, i) => {
      console.log(`   ${i+1}. [${event.event_type}] User: ${event.user_id} - ${event.metadata?.action || 'N/A'} - ${event.created_at}`);
    });

    // Check for our specific events
    const hasLoginEvent = auditTrail.data.events.some(e => e.event_type === 'audit:login_success');
    const hasCourseCreated = auditTrail.data.events.some(e => e.event_type === 'audit:course_created');
    const hasCourseDeleted = auditTrail.data.events.some(e => e.event_type === 'audit:course_deleted');

    console.log('\n   === Audit Event Types Found ===');
    console.log('   audit:login_success:', hasLoginEvent ? 'YES' : 'NO');
    console.log('   audit:course_created:', hasCourseCreated ? 'YES' : 'NO');
    console.log('   audit:course_deleted:', hasCourseDeleted ? 'YES' : 'NO');

    const allPassed = hasCourseCreated && hasCourseDeleted;
    console.log('\n   === VERIFICATION RESULT ===');
    console.log('   Audit trail working:', allPassed ? 'PASSED' : 'FAILED');

    return allPassed;
  } else {
    console.log('   ERROR:', auditTrail.data);
    return false;
  }
}

verify()
  .then(pass => {
    console.log('\n=== Test Complete ===');
    process.exit(pass ? 0 : 1);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
