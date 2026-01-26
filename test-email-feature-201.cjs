// Test script for Feature #201: Email notification for new feedback
const http = require('http');

// First, login as instructor
function login() {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({
      email: 'instructor@test.com',
      password: 'password123'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/direct-auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[Login] Status:', res.statusCode);
        console.log('[Login] Response:', data.substring(0, 200));
        resolve(cookies ? cookies[0].split(';')[0] : null);
      });
    });

    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
}

// Then, create feedback
function createFeedback(sessionCookie) {
  return new Promise((resolve, reject) => {
    const feedbackData = JSON.stringify({
      type: 'rubric',
      total_score: 88,
      max_score: 100,
      comment: 'Excellent work! Your implementation shows great understanding of the concepts.',
      scores: {
        code_quality: 22,
        functionality: 24,
        documentation: 20,
        creativity: 22
      }
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/feedback/submissions/1/feedback',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(feedbackData),
        'Cookie': sessionCookie || ''
      }
    };

    console.log('\n[Feedback] Sending feedback to submission #1...');
    console.log('[Feedback] Cookie:', sessionCookie ? 'Present' : 'Missing');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[Feedback] Status:', res.statusCode);
        console.log('[Feedback] Response:', data);
        resolve(res.statusCode === 201);
      });
    });

    req.on('error', reject);
    req.write(feedbackData);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Testing Feature #201: Email notification for new feedback');
  console.log('='.repeat(60));

  try {
    // Login
    const cookie = await login();
    console.log('[Session] Cookie obtained:', cookie ? 'Yes' : 'No');

    // Create feedback (this should trigger email notification)
    const success = await createFeedback(cookie);

    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('SUCCESS: Feedback created. Check backend console for email notification.');
    } else {
      console.log('WARNING: Feedback request completed but may not have succeeded.');
    }
    console.log('='.repeat(60));
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

main();
