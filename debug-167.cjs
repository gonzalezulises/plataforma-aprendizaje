/**
 * Debug script for Feature #167 - checking json_extract behavior
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
  console.log('=== Debug Feature #167 - json_extract behavior ===\n');

  // Login as instructor
  console.log('1. Logging in as instructor...');
  const loginRes = await makeRequest('POST', '/api/direct-auth/login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes);
    return;
  }
  const userId = loginRes.data.user.id;
  console.log(`   Logged in as user ID: ${userId}`);

  // Get all notifications
  console.log('\n2. Getting all notifications with raw content...');
  const notifRes = await makeRequest('GET', '/api/notifications');
  console.log(`   Status: ${notifRes.status}`);

  if (notifRes.data.notifications?.length > 0) {
    console.log(`   Notifications found: ${notifRes.data.notifications.length}`);
    notifRes.data.notifications.forEach(n => {
      console.log(`\n   ID: ${n.id}`);
      console.log(`   Type: ${n.type}`);
      console.log(`   User_id: ${n.user_id} (type: ${typeof n.user_id})`);
      console.log(`   Content: ${JSON.stringify(n.content)}`);
      console.log(`   Content.webinar_id: ${n.content?.webinar_id} (type: ${typeof n.content?.webinar_id})`);
    });
  } else {
    console.log('   No notifications found');
  }

  // Create a new test webinar
  console.log('\n3. Creating test webinar...');
  const scheduledDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const createRes = await makeRequest('POST', '/api/webinars', {
    title: 'DEBUG_167_JSON_EXTRACT_TEST',
    description: 'Debug webinar for json_extract testing',
    course_id: 1,
    scheduled_at: scheduledDate,
    duration_minutes: 60,
    meet_link: 'https://meet.google.com/debug-167'
  });

  if (createRes.status !== 201) {
    console.error('   Failed to create webinar:', createRes.data);
    return;
  }
  const webinarId = createRes.data.id;
  console.log(`   Created webinar ID: ${webinarId}`);

  // Create a reminder notification manually with correct format
  console.log('\n4. Creating reminder notification with webinar_id = ' + webinarId + '...');
  const notifContent = {
    webinar_id: webinarId,  // This should be an integer
    webinar_title: 'DEBUG_167_JSON_EXTRACT_TEST'
  };
  console.log(`   Content to store: ${JSON.stringify(notifContent)}`);
  console.log(`   webinar_id type in content: ${typeof notifContent.webinar_id}`);

  const createNotif = await makeRequest('POST', '/api/notifications/create', {
    type: 'webinar_reminder',
    title: 'Recordatorio: DEBUG_167',
    message: 'Test reminder',
    content: notifContent
  });
  console.log(`   Create status: ${createNotif.status}`);
  const notifId = createNotif.data?.notification?.id;
  console.log(`   Created notification ID: ${notifId}`);

  // Get notifications to see how it was stored
  console.log('\n5. Checking how notification was stored...');
  const notifRes2 = await makeRequest('GET', '/api/notifications');
  const ourNotif = notifRes2.data.notifications?.find(n => n.id === notifId);
  if (ourNotif) {
    console.log(`   Found notification ID: ${ourNotif.id}`);
    console.log(`   Content type: ${typeof ourNotif.content}`);
    console.log(`   Content: ${JSON.stringify(ourNotif.content)}`);
    console.log(`   Content.webinar_id: ${ourNotif.content?.webinar_id} (type: ${typeof ourNotif.content?.webinar_id})`);
  }

  // Now delete the webinar and check if notification is deleted
  console.log('\n6. Deleting webinar ID ' + webinarId + '...');
  const deleteRes = await makeRequest('DELETE', `/api/webinars/${webinarId}`);
  console.log(`   Delete status: ${deleteRes.status}`);
  console.log(`   Response: ${JSON.stringify(deleteRes.data)}`);
  console.log(`   Reminders cancelled: ${deleteRes.data?.reminders_cancelled}`);

  // Check if notification still exists
  console.log('\n7. Checking if notification was deleted...');
  const notifRes3 = await makeRequest('GET', '/api/notifications');
  const remainingNotif = notifRes3.data.notifications?.find(n => n.id === notifId);
  if (remainingNotif) {
    console.log(`   FAIL: Notification ID ${notifId} still exists!`);
    console.log(`   Content: ${JSON.stringify(remainingNotif.content)}`);
  } else {
    console.log(`   SUCCESS: Notification ID ${notifId} was deleted!`);
  }
}

test().catch(console.error);
