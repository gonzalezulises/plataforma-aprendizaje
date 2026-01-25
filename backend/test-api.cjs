const http = require('http');

// Test with different search queries
const tests = [
  { search: 'Fundamentos', name: 'simple search' },
  { search: '"Fundamentos"', name: 'quoted search' },
  { search: '"Python Fundamentos"', name: 'quoted phrase' },
  { search: '"Python', name: 'unbalanced quote' },
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:5001/api/courses?search=${encodeURIComponent(test.search)}`;
    console.log(`\nTest: ${test.name}`);
    console.log(`  Query: ${test.search}`);
    console.log(`  URL: ${url}`);

    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`  Results: ${json.courses.length} courses`);
          json.courses.forEach(c => console.log(`    - ${c.title}`));
          resolve();
        } catch (e) {
          console.log(`  Error parsing response: ${e.message}`);
          resolve();
        }
      });
    }).on('error', (e) => {
      console.log(`  Request error: ${e.message}`);
      resolve();
    });
  });
}

(async () => {
  for (const test of tests) {
    await runTest(test);
  }
})();
