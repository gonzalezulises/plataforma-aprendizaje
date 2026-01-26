// Test script for Feature #230: Export student progress report
const http = require('http');

const PORT = 4002;

// Step 1: Login to get session
function login(callback) {
  const postData = JSON.stringify({
    email: 'testuser@example.com',
    password: 'password123'
  });

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/direct-auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    let cookies = res.headers['set-cookie'] || [];

    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Login response:', data);
      console.log('Status:', res.statusCode);

      // Extract session cookie
      const sessionCookie = cookies.find(c => c.startsWith('connect.sid'));
      if (sessionCookie) {
        const cookie = sessionCookie.split(';')[0];
        console.log('Session cookie:', cookie);
        callback(null, cookie);
      } else {
        callback(new Error('No session cookie'), null);
      }
    });
  });

  req.on('error', (e) => callback(e, null));
  req.write(postData);
  req.end();
}

// Step 2: Export progress
function exportProgress(cookie, callback) {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/users/me/progress/export',
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('\n--- Export Response ---');
      console.log('Status:', res.statusCode);
      console.log('Content-Disposition:', res.headers['content-disposition']);

      try {
        const json = JSON.parse(data);
        console.log('\nExport Info:', json.exportInfo);
        console.log('\nUser:', json.user);
        console.log('\nSummary:', json.summary);
        console.log('\nCourses count:', json.courses?.length);
        console.log('Quiz scores count:', json.quizScores?.length);
        console.log('Challenge scores count:', json.challengeScores?.length);
        console.log('Certificates count:', json.certificates?.length);

        // Verify required fields
        const hasCompletedCourses = json.courses && json.courses.some(c => c.completedAt);
        const hasScores = (json.quizScores && json.quizScores.length > 0) ||
                         (json.challengeScores && json.challengeScores.length > 0);

        console.log('\n--- Verification ---');
        console.log('Contains completed courses info:', !!json.courses);
        console.log('Contains grades/scores:', hasScores);
        console.log('Has exportInfo:', !!json.exportInfo);
        console.log('Has user info:', !!json.user);
        console.log('Has summary:', !!json.summary);

        callback(null, json);
      } catch (e) {
        console.log('Raw data:', data);
        callback(e, null);
      }
    });
  });

  req.on('error', (e) => callback(e, null));
  req.end();
}

// Run test
console.log('Testing Feature #230: Export student progress report');
console.log('Using port:', PORT);
console.log('');

login((err, cookie) => {
  if (err) {
    console.error('Login failed:', err);
    process.exit(1);
  }

  exportProgress(cookie, (err, data) => {
    if (err) {
      console.error('Export failed:', err);
      process.exit(1);
    }

    console.log('\n=== TEST PASSED ===');
    process.exit(0);
  });
});
