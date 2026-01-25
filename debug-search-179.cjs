/**
 * Debug script for Feature #179 - Quotes in search
 */

const http = require('http');

function makeRequest(searchTerm) {
  return new Promise((resolve, reject) => {
    const encodedSearch = encodeURIComponent(searchTerm);
    const url = `http://localhost:3001/api/courses?search=${encodedSearch}`;

    console.log(`\n--- Testing: "${searchTerm}" ---`);
    console.log(`URL: ${url}`);

    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`Results: ${json.courses.length} courses found`);
          if (json.courses.length > 0) {
            json.courses.forEach(c => {
              console.log(`  - ${c.title}`);
            });
          }
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Test 1: Search without quotes (should match courses with "desde" AND "cero")
  await makeRequest('desde cero');

  // Test 2: Search with quotes (exact phrase)
  await makeRequest('"desde cero"');

  // Test 3: Search for a phrase that exists exactly
  await makeRequest('"Python desde cero"');

  // Test 4: Mixed search
  await makeRequest('Python "desde cero"');

  // Test 5: Unbalanced quote
  await makeRequest('"Python desde');

  // Test 6: Single quotes
  await makeRequest("'desde cero'");
}

main().catch(console.error);
