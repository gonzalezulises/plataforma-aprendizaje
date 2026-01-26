/**
 * Test script for Feature #34: Rate limiting on code execution
 * Sends rapid code execution requests to verify rate limiting works
 */

const http = require('http');

const NUM_REQUESTS = 25;
const results = [];

function makeRequest(requestNum) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      code: 'print("Hello World")',
      language: 'python'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/challenges/1/run',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const endTime = Date.now();
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { error: 'Parse error', raw: data.substring(0, 100) };
        }

        resolve({
          requestNum,
          statusCode: res.statusCode,
          rateLimited: res.statusCode === 429,
          responseTime: endTime - startTime,
          response: parsed
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        requestNum,
        error: e.message,
        rateLimited: false
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log(`\n=== Feature #34 Rate Limiting Test ===`);
  console.log(`Sending ${NUM_REQUESTS} rapid code execution requests...\n`);

  // Clear rate limits first
  await new Promise((resolve) => {
    const postData = JSON.stringify({ clearAll: true });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/test/clear-code-exec-rate-limit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Rate limits cleared:', data);
        resolve();
      });
    });
    req.write(postData);
    req.end();
  });

  // Send requests rapidly (all at once)
  const promises = [];
  for (let i = 1; i <= NUM_REQUESTS; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);

  // Analyze results
  const successful = results.filter(r => r.statusCode === 200);
  const rateLimited = results.filter(r => r.statusCode === 429);
  const errors = results.filter(r => r.error);

  console.log('\n=== Results ===');
  console.log(`Total requests: ${NUM_REQUESTS}`);
  console.log(`Successful (200): ${successful.length}`);
  console.log(`Rate limited (429): ${rateLimited.length}`);
  console.log(`Errors: ${errors.length}`);

  // Show first and last few responses
  console.log('\n--- First 5 responses ---');
  results.slice(0, 5).forEach(r => {
    console.log(`  Request ${r.requestNum}: ${r.statusCode} (${r.responseTime}ms) ${r.rateLimited ? 'RATE LIMITED' : ''}`);
  });

  console.log('\n--- Last 5 responses ---');
  results.slice(-5).forEach(r => {
    console.log(`  Request ${r.requestNum}: ${r.statusCode} (${r.responseTime}ms) ${r.rateLimited ? 'RATE LIMITED' : ''}`);
  });

  // Show rate limit error message if any
  if (rateLimited.length > 0) {
    console.log('\n--- Rate limit response example ---');
    const example = rateLimited[0].response;
    console.log('  Error:', example.error || example.error_en);
    console.log('  Retry after:', example.retryAfter, 'seconds');
    console.log('  Limit:', example.limit, 'requests per', example.window, 'seconds');
  }

  // Verify test passed
  console.log('\n=== Verification ===');
  const passed = rateLimited.length > 0 && successful.length <= 20;
  if (passed) {
    console.log('✅ PASS: Rate limiting is working correctly');
    console.log(`   - ${successful.length} requests succeeded (limit is 20)`);
    console.log(`   - ${rateLimited.length} requests were rate limited`);
  } else {
    console.log('❌ FAIL: Rate limiting may not be working');
    console.log(`   - Expected some requests to be rate limited (429)`);
    console.log(`   - Got ${rateLimited.length} rate limited requests`);
  }

  return passed;
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
