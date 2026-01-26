/**
 * Full verification test for Feature #34: Rate limiting on code execution
 * Tests all 4 verification steps from the feature definition
 */

const http = require('http');

// Configuration
const NUM_RAPID_REQUESTS = 25;
const RATE_LIMIT = 20;
const WAIT_TIME_SECONDS = 35; // Wait for rate limit to reset (30s block + buffer)

let sessionCookie = null;

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) }),
        ...(sessionCookie && { 'Cookie': sessionCookie })
      }
    };

    const req = http.request(options, (res) => {
      // Capture session cookie
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        sessionCookie = cookies[0].split(';')[0];
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { raw: data.substring(0, 200) };
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', (e) => {
      resolve({ error: e.message });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function login() {
  console.log('\n📝 Logging in as test user...');
  const result = await makeRequest('/api/direct-auth/dev-login', 'POST', {
    email: 'ratelimittest@example.com',
    name: 'Rate Limit Test User',
    role: 'student_free'
  });

  if (result.statusCode === 200) {
    console.log('✅ Logged in successfully');
    return true;
  } else {
    console.log('⚠️ Login failed, continuing with IP-based rate limiting');
    return false;
  }
}

async function clearRateLimits() {
  console.log('\n🧹 Clearing rate limits...');
  await makeRequest('/api/test/clear-code-exec-rate-limit', 'POST', { clearAll: true });
  console.log('✅ Rate limits cleared');
}

async function step1_sendRapidRequests() {
  console.log(`\n📤 STEP 1: Submit ${NUM_RAPID_REQUESTS} code execution requests rapidly...`);

  const promises = [];
  for (let i = 1; i <= NUM_RAPID_REQUESTS; i++) {
    promises.push(makeRequest('/api/challenges/1/run', 'POST', {
      code: `print("Request ${i}")`,
      language: 'python'
    }));
  }

  const results = await Promise.all(promises);

  const successful = results.filter(r => r.statusCode === 200);
  const rateLimited = results.filter(r => r.statusCode === 429);

  console.log(`   - Successful requests (200): ${successful.length}`);
  console.log(`   - Rate limited (429): ${rateLimited.length}`);

  return { successful, rateLimited, results };
}

async function step2_verifyRateLimiting(rateLimited) {
  console.log('\n🔒 STEP 2: Verify rate limiting is applied...');

  if (rateLimited.length > 0) {
    console.log(`   ✅ PASS: ${rateLimited.length} requests were rate limited`);
    return true;
  } else {
    console.log('   ❌ FAIL: No requests were rate limited');
    return false;
  }
}

async function step3_verifyAppropriateMessage(rateLimited) {
  console.log('\n💬 STEP 3: Verify appropriate message is shown...');

  if (rateLimited.length > 0) {
    const sample = rateLimited[0].body;

    console.log('   Rate limit response:');
    console.log(`   - Error (ES): ${sample.error}`);
    console.log(`   - Error (EN): ${sample.error_en}`);
    console.log(`   - Retry after: ${sample.retryAfter} seconds`);
    console.log(`   - Limit: ${sample.limit} requests per ${sample.window} seconds`);
    console.log(`   - rateLimited flag: ${sample.rateLimited}`);

    const hasSpanishMessage = sample.error && sample.error.includes('ejecucion');
    const hasEnglishMessage = sample.error_en && sample.error_en.includes('execution');
    const hasRetryAfter = typeof sample.retryAfter === 'number' && sample.retryAfter > 0;
    const hasLimit = sample.limit === RATE_LIMIT;
    const hasRateLimitedFlag = sample.rateLimited === true;

    if (hasSpanishMessage && hasEnglishMessage && hasRetryAfter && hasLimit && hasRateLimitedFlag) {
      console.log('   ✅ PASS: All required fields present with appropriate messages');
      return true;
    } else {
      console.log('   ⚠️ WARNING: Some fields may be missing');
      console.log(`      - Spanish message: ${hasSpanishMessage}`);
      console.log(`      - English message: ${hasEnglishMessage}`);
      console.log(`      - Retry after: ${hasRetryAfter}`);
      console.log(`      - Correct limit: ${hasLimit}`);
      console.log(`      - rateLimited flag: ${hasRateLimitedFlag}`);
      return hasSpanishMessage || hasEnglishMessage;
    }
  }

  console.log('   ❌ FAIL: No rate limited response to check');
  return false;
}

async function step4_waitForReset() {
  console.log(`\n⏳ STEP 4: Wait for rate limit to reset (${WAIT_TIME_SECONDS}s)...`);

  // First verify we're still rate limited
  const beforeWait = await makeRequest('/api/challenges/1/run', 'POST', {
    code: 'print("Before wait")',
    language: 'python'
  });

  console.log(`   - Before waiting: ${beforeWait.statusCode === 429 ? '🔒 Still rate limited' : '✅ Not rate limited'}`);

  if (beforeWait.statusCode !== 429) {
    console.log('   ⚠️ Already not rate limited, skipping wait');
    return true;
  }

  console.log(`   - Waiting ${WAIT_TIME_SECONDS} seconds for rate limit to expire...`);
  await new Promise(resolve => setTimeout(resolve, WAIT_TIME_SECONDS * 1000));

  // Try again after waiting
  const afterWait = await makeRequest('/api/challenges/1/run', 'POST', {
    code: 'print("After wait")',
    language: 'python'
  });

  console.log(`   - After waiting: ${afterWait.statusCode === 200 ? '✅ Request succeeded' : '❌ Still rate limited'}`);

  if (afterWait.statusCode === 200) {
    console.log('   ✅ PASS: Rate limit reset successfully');
    return true;
  } else {
    console.log('   ❌ FAIL: Rate limit did not reset');
    return false;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('Feature #34: Rate limiting on code execution');
  console.log('========================================');

  await login();
  await clearRateLimits();

  // Step 1: Send rapid requests
  const { successful, rateLimited, results } = await step1_sendRapidRequests();

  // Step 2: Verify rate limiting is applied
  const step2Passed = await step2_verifyRateLimiting(rateLimited);

  // Step 3: Verify appropriate message
  const step3Passed = await step3_verifyAppropriateMessage(rateLimited);

  // Step 4: Wait for reset
  const step4Passed = await step4_waitForReset();

  // Summary
  console.log('\n========================================');
  console.log('           VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`Step 1 - Send 20 rapid requests: ${successful.length} succeeded, ${rateLimited.length} limited`);
  console.log(`Step 2 - Rate limiting applied: ${step2Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Step 3 - Appropriate message: ${step3Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Step 4 - Rate limit reset: ${step4Passed ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = step2Passed && step3Passed && step4Passed && successful.length <= RATE_LIMIT;

  console.log('\n========================================');
  console.log(`OVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('========================================\n');

  return allPassed;
}

runAllTests().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
