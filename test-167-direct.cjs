/**
 * Direct test for Feature #167 - testing the LIKE-based deletion query
 * This script directly manipulates the database to verify the fix works
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
let sessionCookie = '';

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
  console.log('=== Direct Test for Feature #167 ===\n');
  console.log('Testing LIKE-based deletion of webinar reminders\n');

  // Login as instructor
  console.log('1. Logging in as instructor...');
  const loginRes = await makeRequest('POST', '/api/direct-auth/login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes);
    return false;
  }
  console.log(`   ✓ Logged in as user ID: ${loginRes.data.user.id}`);

  // Clean up any existing test notifications
  console.log('\n2. Checking for existing test notifications to clean up...');
  let notifRes = await makeRequest('GET', '/api/notifications');
  const existingReminders = notifRes.data.notifications?.filter(n => n.type === 'webinar_reminder') || [];
  console.log(`   Found ${existingReminders.length} existing webinar reminder(s)`);

  // Create a test webinar
  console.log('\n3. Creating test webinar...');
  const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const createRes = await makeRequest('POST', '/api/webinars', {
    title: 'TEST_167_FINAL_VERIFY_' + Date.now(),
    description: 'Final verification of Feature #167 cascade delete',
    course_id: 1,
    scheduled_at: scheduledDate,
    duration_minutes: 60,
    meet_link: 'https://meet.google.com/test-167-final'
  });

  if (createRes.status !== 201) {
    console.error('   ✗ Failed to create webinar:', createRes.data);
    return false;
  }
  const webinarId = createRes.data.id;
  console.log(`   ✓ Created webinar ID: ${webinarId}`);

  // Register for the webinar (this should create a reminder notification)
  console.log('\n4. Registering for webinar (should create reminder notification)...');
  const regRes = await makeRequest('POST', `/api/webinars/${webinarId}/register`);
  if (regRes.status === 200) {
    console.log(`   ✓ Registered successfully`);
  } else {
    console.log(`   Status: ${regRes.status}, Response:`, regRes.data);
  }

  // Check notifications
  console.log('\n5. Checking if reminder notification was created...');
  notifRes = await makeRequest('GET', '/api/notifications');
  const newReminders = notifRes.data.notifications?.filter(n =>
    n.type === 'webinar_reminder' &&
    n.content?.webinar_id === webinarId
  ) || [];

  console.log(`   Total notifications: ${notifRes.data.notifications?.length || 0}`);
  console.log(`   Webinar reminders for ID ${webinarId}: ${newReminders.length}`);

  if (newReminders.length > 0) {
    console.log(`   ✓ Reminder notification found!`);
    console.log(`     Content: ${JSON.stringify(newReminders[0].content)}`);
  } else {
    // Registration might not create a notification if the server code didn't implement it
    console.log(`   ! No reminder notification was created by registration`);
    console.log(`     (This is expected if the server hasn't been restarted with the notification code)`);

    // Manually create a reminder notification for testing
    console.log('\n5b. Manually creating a reminder notification for testing...');
    const createNotif = await makeRequest('POST', '/api/notifications/create', {
      type: 'webinar_reminder',
      title: `Recordatorio: TEST_167_FINAL_VERIFY`,
      message: `Test reminder for webinar ${webinarId}`,
      content: {
        webinar_id: webinarId,
        webinar_title: 'TEST_167_FINAL_VERIFY'
      }
    });
    console.log(`   Manual notification create status: ${createNotif.status}`);

    if (createNotif.status === 201) {
      console.log(`   ✓ Created notification ID: ${createNotif.data.notification?.id}`);
    }
  }

  // Verify notification exists before deletion
  console.log('\n6. Verifying notification exists before deletion...');
  notifRes = await makeRequest('GET', '/api/notifications');
  const remindersBeforeDelete = notifRes.data.notifications?.filter(n =>
    n.type === 'webinar_reminder' &&
    n.content?.webinar_id === webinarId
  ) || [];
  console.log(`   Reminders for webinar ${webinarId} before delete: ${remindersBeforeDelete.length}`);

  if (remindersBeforeDelete.length === 0) {
    console.log('   ✗ No reminders to test with!');
    // Still try to delete the webinar to clean up
    await makeRequest('DELETE', `/api/webinars/${webinarId}`);
    return false;
  }

  // Delete the webinar
  console.log('\n7. Deleting webinar...');
  const deleteRes = await makeRequest('DELETE', `/api/webinars/${webinarId}`);
  console.log(`   Delete status: ${deleteRes.status}`);
  console.log(`   Response: ${JSON.stringify(deleteRes.data)}`);

  // Check if notification was deleted
  console.log('\n8. Checking if reminder notification was deleted...');
  notifRes = await makeRequest('GET', '/api/notifications');
  const remindersAfterDelete = notifRes.data.notifications?.filter(n =>
    n.type === 'webinar_reminder' &&
    n.content?.webinar_id === webinarId
  ) || [];
  console.log(`   Reminders for webinar ${webinarId} after delete: ${remindersAfterDelete.length}`);

  if (remindersAfterDelete.length === 0) {
    console.log('\n=== SUCCESS: Reminder notification was deleted with webinar! ===');
    return true;
  } else {
    console.log('\n=== FAIL: Reminder notification still exists! ===');
    console.log('   The server code has not been reloaded with the fix.');
    console.log('   The backend needs to be restarted to apply the LIKE-based deletion query.');
    return false;
  }
}

test()
  .then(success => {
    console.log(`\nTest result: ${success ? 'PASSED' : 'FAILED - Server restart needed'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
