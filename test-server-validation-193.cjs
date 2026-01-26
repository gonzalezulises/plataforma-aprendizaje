const http = require('http');

// Test 1: Invalid data (too short title and content)
const postData = JSON.stringify({
  title: 'AB',
  content: 'Test',
  userId: 'test-user',
  userName: 'Test User'
});

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/forum/course/1/thread',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== Test 1: Invalid data (short title and content) ===');
    console.log('Status:', res.statusCode);
    console.log('Response:', JSON.parse(data));
    console.log('');

    // Test 2: Empty title
    runTest2();
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();

function runTest2() {
  const postData2 = JSON.stringify({
    title: '',
    content: 'This is valid content for the test',
    userId: 'test-user',
    userName: 'Test User'
  });

  const options2 = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/forum/course/1/thread',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData2)
    }
  };

  const req2 = http.request(options2, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('=== Test 2: Empty title ===');
      console.log('Status:', res.statusCode);
      console.log('Response:', JSON.parse(data));
      console.log('');

      // Test 3: Empty content
      runTest3();
    });
  });

  req2.on('error', (e) => console.error('Error:', e.message));
  req2.write(postData2);
  req2.end();
}

function runTest3() {
  const postData3 = JSON.stringify({
    title: 'Valid Title Here',
    content: '',
    userId: 'test-user',
    userName: 'Test User'
  });

  const options3 = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/forum/course/1/thread',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData3)
    }
  };

  const req3 = http.request(options3, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('=== Test 3: Empty content ===');
      console.log('Status:', res.statusCode);
      console.log('Response:', JSON.parse(data));
      console.log('');

      console.log('=== SERVER-SIDE VALIDATION TESTS COMPLETE ===');
    });
  });

  req3.on('error', (e) => console.error('Error:', e.message));
  req3.write(postData3);
  req3.end();
}
