const http = require('http');

// First, login as instructor_admin to get session cookie
const loginData = JSON.stringify({
  email: 'instructor-admin@example.com',
  role: 'instructor_admin'
});

const loginReq = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/dev-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, (res) => {
  let data = '';
  const cookies = res.headers['set-cookie'];
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Login response:', data);

    if (cookies) {
      const sessionCookie = cookies.find(c => c.startsWith('connect.sid'));
      const cookieValue = sessionCookie ? sessionCookie.split(';')[0] : '';

      // Get CSRF token
      const csrfReq = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/csrf-token',
        method: 'GET',
        headers: {
          'Cookie': cookieValue
        }
      }, (csrfRes) => {
        let csrfData = '';
        csrfRes.on('data', chunk => csrfData += chunk);
        csrfRes.on('end', () => {
          console.log('CSRF response:', csrfData);
          const csrfJson = JSON.parse(csrfData);
          const csrfToken = csrfJson.csrfToken;

          // Now delete the course with the session cookie and CSRF token
          const deleteReq = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/courses/13',
            method: 'DELETE',
            headers: {
              'Cookie': cookieValue,
              'X-CSRF-Token': csrfToken
            }
          }, (delRes) => {
            let delData = '';
            delRes.on('data', chunk => delData += chunk);
            delRes.on('end', () => {
              console.log('Delete status:', delRes.statusCode);
              console.log('Delete response:', delData);
            });
          });
          deleteReq.end();
        });
      });
      csrfReq.end();
    }
  });
});

loginReq.write(loginData);
loginReq.end();
