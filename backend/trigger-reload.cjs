// Trigger nodemon reload by touching the index.js file
const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';

let content = fs.readFileSync(path, 'utf8');

// Add or update a comment at the top to trigger change
const timestamp = new Date().toISOString();
if (content.startsWith('// Last reload:')) {
  content = content.replace(/^\/\/ Last reload:.*\n/, `// Last reload: ${timestamp}\n`);
} else {
  content = `// Last reload: ${timestamp}\n` + content;
}

fs.writeFileSync(path, content);
console.log('Triggered reload at:', timestamp);
