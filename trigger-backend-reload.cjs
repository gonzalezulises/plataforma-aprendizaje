const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');
const now = new Date().toISOString();
content = content.replace(/\/\/ Last reload: .+/, `// Last reload: ${now}`);
fs.writeFileSync(path, content);
console.log('Triggered reload at', now);
