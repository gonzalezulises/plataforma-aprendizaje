// Publish all courses via API
const http = require('http');

function makeRequest(method, path, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let body = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), setCookie });
        } catch {
          resolve({ status: res.statusCode, data: body, setCookie });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // Login
  console.log('Logging in...');
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  let cookie = '';
  if (loginRes.setCookie) {
    cookie = loginRes.setCookie[0].split(';')[0];
  }

  // Publish courses from id 1 to 111
  console.log('Publishing all courses...');
  let published = 0;

  for (let i = 1; i <= 111; i++) {
    const res = await makeRequest('PUT', `/api/courses/${i}/publish`, {}, cookie);
    if (res.status === 200) {
      published++;
      if (published % 20 === 0) {
        console.log(`Published ${published} courses...`);
      }
    }
  }

  console.log(`Done! Published ${published} courses`);

  // Check final count
  const final = await makeRequest('GET', '/api/courses', null, cookie);
  console.log('Final courses list length:', final.data?.courses?.length);
  console.log('Final total:', final.data?.total);
}

main().catch(console.error);
