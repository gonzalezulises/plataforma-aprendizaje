const fs = require('fs');

// Create a 15MB file (larger than 10MB limit)
const size = 15 * 1024 * 1024;
const buffer = Buffer.alloc(size, 'x');
fs.writeFileSync('C:/Users/gonza/claude-projects/test-large-file.txt', buffer);
console.log('Created large file:', size, 'bytes (15MB)');
