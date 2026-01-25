// Check if the parseSearchQuery function works when required dynamically
const fs = require('fs');

// Read the searchUtils.js file and extract the function
const searchUtilsPath = 'C:/Users/gonza/claude-projects/backend/src/utils/searchUtils.js';
const content = fs.readFileSync(searchUtilsPath, 'utf8');
console.log('searchUtils.js exists:', fs.existsSync(searchUtilsPath));
console.log('Content length:', content.length);
console.log('\nFirst 200 chars:\n', content.slice(0, 200));

// Read the courses.js to check if import is there
const coursesPath = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
const coursesContent = fs.readFileSync(coursesPath, 'utf8');

console.log('\n\n=== Checking courses.js ===');
console.log('Has parseSearchQuery import:', coursesContent.includes("import { parseSearchQuery }"));
console.log('Has DEBUG #179:', coursesContent.includes('[DEBUG #179]'));

// Find the search handling code
const searchCodeStart = coursesContent.indexOf('// Feature #179');
if (searchCodeStart >= 0) {
  console.log('\nFeature #179 code found at position:', searchCodeStart);
  console.log('\nCode snippet:');
  console.log(coursesContent.slice(searchCodeStart, searchCodeStart + 400));
}
