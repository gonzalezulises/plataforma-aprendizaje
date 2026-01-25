/**
 * Test script for Feature #167: Deleting webinar removes reminders
 *
 * Steps:
 * 1. Schedule a webinar
 * 2. Verify reminders are scheduled
 * 3. Delete the webinar
 * 4. Check notifications table
 * 5. Verify reminders are cancelled
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let sessionCookie = '';
let testWebinarId = null;
let testUserId = null;

function makeRequest(method, path, data = null) {
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

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // Capture session cookie
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('=== Feature #167: Deleting webinar removes reminders ===\n');

  // Step 0: Login as instructor
  console.log('Step 0: Logging in as instructor...');
  const loginRes = await makeRequest('POST', '/api/direct-auth/login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes);
    return false;
  }
  testUserId = loginRes.data.user.id;
  console.log(`  ✓ Logged in as instructor (ID: ${testUserId})`);

  // Step 1: Schedule a webinar
  console.log('\nStep 1: Schedule a webinar...');
  const scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const createRes = await makeRequest('POST', '/api/webinars', {
    title: 'TEST_167_WEBINAR_CASCADE_DELETE',
    description: 'Test webinar for verifying reminder cascade delete',
    course_id: 1,
    scheduled_at: scheduledDate,
    duration_minutes: 60,
    meet_link: 'https://meet.google.com/test-167-link'
  });

  if (createRes.status !== 201) {
    console.error('  ✗ Failed to create webinar:', createRes.data);
    return false;
  }
  testWebinarId = createRes.data.id;
  console.log(`  ✓ Created webinar ID: ${testWebinarId}`);
  console.log(`    Title: ${createRes.data.title}`);
  console.log(`    Scheduled at: ${createRes.data.scheduled_at}`);

  // Step 1b: Register for the webinar (as the instructor, to create a reminder)
  console.log('\nStep 1b: Registering for the webinar to create a reminder notification...');
  const registerRes = await makeRequest('POST', `/api/webinars/${testWebinarId}/register`);

  if (registerRes.status !== 200) {
    console.error('  ✗ Failed to register:', registerRes.data);
    return false;
  }
  console.log(`  ✓ Registered for webinar`);

  // Step 2: Verify reminders are scheduled
  console.log('\nStep 2: Verify reminders are scheduled (check notifications)...');
  const notifRes = await makeRequest('GET', '/api/notifications');

  if (notifRes.status !== 200) {
    console.error('  ✗ Failed to get notifications:', notifRes.data);
    return false;
  }

  const webinarReminders = notifRes.data.notifications.filter(n =>
    n.type === 'webinar_reminder' &&
    n.content?.webinar_id === testWebinarId
  );

  if (webinarReminders.length === 0) {
    console.error('  ✗ No reminder notification found for webinar');
    return false;
  }

  console.log(`  ✓ Found ${webinarReminders.length} reminder notification(s) for webinar ${testWebinarId}`);
  webinarReminders.forEach(r => {
    console.log(`    - ID: ${r.id}, Title: ${r.title}, Type: ${r.type}`);
    console.log(`      Content: webinar_id=${r.content?.webinar_id}`);
  });

  const reminderIdsBefore = webinarReminders.map(r => r.id);

  // Step 3: Delete the webinar
  console.log('\nStep 3: Delete the webinar...');
  const deleteRes = await makeRequest('DELETE', `/api/webinars/${testWebinarId}`);

  if (deleteRes.status !== 200) {
    console.error('  ✗ Failed to delete webinar:', deleteRes.data);
    return false;
  }
  console.log(`  ✓ Webinar deleted successfully`);
  console.log(`    Response: ${JSON.stringify(deleteRes.data)}`);
  console.log(`    Reminders cancelled: ${deleteRes.data.reminders_cancelled}`);

  // Step 4 & 5: Check notifications table and verify reminders are cancelled
  console.log('\nStep 4 & 5: Check notifications table - verify reminders are cancelled...');
  const notifAfterRes = await makeRequest('GET', '/api/notifications');

  if (notifAfterRes.status !== 200) {
    console.error('  ✗ Failed to get notifications after delete:', notifAfterRes.data);
    return false;
  }

  const remainingReminders = notifAfterRes.data.notifications.filter(n =>
    n.type === 'webinar_reminder' &&
    n.content?.webinar_id === testWebinarId
  );

  if (remainingReminders.length > 0) {
    console.error(`  ✗ FAIL: Found ${remainingReminders.length} reminder(s) still exist for deleted webinar!`);
    remainingReminders.forEach(r => {
      console.error(`    - ID: ${r.id}, Title: ${r.title}`);
    });
    return false;
  }

  console.log(`  ✓ SUCCESS: All reminder notifications for webinar ${testWebinarId} have been deleted!`);
  console.log(`    Before deletion: ${reminderIdsBefore.length} reminder(s)`);
  console.log(`    After deletion: ${remainingReminders.length} reminder(s)`);

  // Verify webinar no longer exists
  console.log('\nVerifying webinar no longer exists...');
  const webinarCheckRes = await makeRequest('GET', `/api/webinars/${testWebinarId}`);
  if (webinarCheckRes.status === 404) {
    console.log('  ✓ Webinar confirmed deleted (404 Not Found)');
  } else {
    console.error('  ✗ Webinar still exists!', webinarCheckRes);
    return false;
  }

  console.log('\n=== ALL STEPS PASSED ===');
  console.log('Feature #167: Deleting webinar removes reminders - VERIFIED');
  return true;
}

test()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
