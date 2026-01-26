const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/Last reload:.*/, 'Last reload: 2026-01-25T21:51:30.000Z - Feature #170');
fs.writeFileSync(path, content);
console.log('Backend file updated to trigger nodemon restart');
