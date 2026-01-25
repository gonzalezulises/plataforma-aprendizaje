/**
 * Check notifications for Feature #167 testing
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
  console.log('=== Checking Notifications for Feature #167 ===\n');

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
  console.log(`   Logged in as user ID: ${userId} (type: ${typeof userId})`);

  // Check current notifications
  console.log('\n2. Getting notifications...');
  const notifRes = await makeRequest('GET', '/api/notifications');
  console.log(`   Status: ${notifRes.status}`);
  console.log(`   Notifications count: ${notifRes.data.notifications?.length || 0}`);

  if (notifRes.data.notifications?.length > 0) {
    console.log('   Sample notifications:');
    notifRes.data.notifications.slice(0, 5).forEach(n => {
      console.log(`     - ID: ${n.id}, Type: ${n.type}, User: ${n.user_id} (${typeof n.user_id}), Title: ${n.title?.substring(0, 50)}`);
    });
  }

  // Get webinars
  console.log('\n3. Getting webinars...');
  const webinarsRes = await makeRequest('GET', '/api/webinars');
  console.log(`   Status: ${webinarsRes.status}`);
  console.log(`   Webinars count: ${webinarsRes.data?.length || 0}`);

  // Find our test webinar
  const testWebinar = webinarsRes.data?.find(w => w.title?.includes('TEST_167_VERIFY_CASCADE'));
  if (testWebinar) {
    console.log(`   Found test webinar: ID ${testWebinar.id}, Title: ${testWebinar.title}, Registered: ${testWebinar.registered_count}`);

    // Try to create a reminder manually for testing
    console.log('\n4. Creating a test reminder notification manually...');
    const createNotif = await makeRequest('POST', '/api/notifications/create', {
      type: 'webinar_reminder',
      title: `Recordatorio: ${testWebinar.title}`,
      message: `Test reminder for webinar ${testWebinar.id}`,
      content: {
        webinar_id: testWebinar.id,
        webinar_title: testWebinar.title
      }
    });
    console.log(`   Create notification status: ${createNotif.status}`);
    console.log(`   Response:`, JSON.stringify(createNotif.data, null, 2));

    // Check notifications again
    console.log('\n5. Getting notifications after manual creation...');
    const notifRes2 = await makeRequest('GET', '/api/notifications');
    console.log(`   Status: ${notifRes2.status}`);
    console.log(`   Notifications count: ${notifRes2.data.notifications?.length || 0}`);

    const webinarReminders = notifRes2.data.notifications?.filter(n =>
      n.type === 'webinar_reminder' && n.content?.webinar_id === testWebinar.id
    );
    console.log(`   Webinar reminders for test webinar: ${webinarReminders?.length || 0}`);

    if (webinarReminders?.length > 0) {
      console.log('\n6. Deleting the test webinar...');
      const deleteRes = await makeRequest('DELETE', `/api/webinars/${testWebinar.id}`);
      console.log(`   Delete status: ${deleteRes.status}`);
      console.log(`   Response:`, JSON.stringify(deleteRes.data, null, 2));

      // Check notifications after deletion
      console.log('\n7. Getting notifications after webinar deletion...');
      const notifRes3 = await makeRequest('GET', '/api/notifications');
      const remainingReminders = notifRes3.data.notifications?.filter(n =>
        n.type === 'webinar_reminder' && n.content?.webinar_id === testWebinar.id
      );
      console.log(`   Remaining webinar reminders for deleted webinar: ${remainingReminders?.length || 0}`);

      if (remainingReminders?.length === 0) {
        console.log('\n=== SUCCESS: Reminders were deleted with webinar! ===');
      } else {
        console.log('\n=== FAIL: Reminders still exist after webinar deletion! ===');
      }
    }
  } else {
    console.log('   Test webinar not found');
  }
}

test().catch(console.error);
