const http = require('http');

// Test with different search queries and log exactly what comes back
const tests = [
  { search: 'Fundamentos', name: 'simple search' },
  { search: '"Fundamentos"', name: 'quoted search' },
];

async function runTest(test) {
  return new Promise((resolve) => {
    const encodedSearch = encodeURIComponent(test.search);
    const url = `http://localhost:5001/api/courses?search=${encodedSearch}`;

    console.log(`\n=== ${test.name} ===`);
    console.log(`Raw query: ${test.search}`);
    console.log(`Encoded: ${encodedSearch}`);
    console.log(`Full URL: ${url}`);

    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Results: ${json.courses.length} courses`);
          if (json.courses.length > 0) {
            json.courses.forEach(c => console.log(`  - "${c.title}"`));
          }
          resolve();
        } catch (e) {
          console.log(`Parse error: ${e.message}`);
          console.log(`Raw data: ${data.slice(0, 200)}`);
          resolve();
        }
      });
    }).on('error', (e) => {
      console.log(`Request error: ${e.message}`);
      resolve();
    });
  });
}

(async () => {
  console.log('Starting API trace tests...');
  console.log('Check server console for [DEBUG #179] output');

  for (const test of tests) {
    await runTest(test);
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== Tests complete ===');
})();
