// This file triggers nodemon reload by touching courses.js
const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
const content = fs.readFileSync(path, 'utf8');
// Add a timestamp comment to trigger reload
const now = new Date().toISOString();
const updated = content.replace(
  /\/\/ Delete related data that may not have CASCADE constraints.*/,
  `// Delete related data that may not have CASCADE constraints - updated ${now}`
);
fs.writeFileSync(path, updated, 'utf8');
console.log('Triggered reload by updating courses.js');
