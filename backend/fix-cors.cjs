const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');

// Add more ports to CORS
const oldCors = `    // List of allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175'
    ];`;

const newCors = `    // List of allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
      'http://localhost:5180'
    ];`;

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

if (content.includes(oldCors)) {
  content = content.replace(oldCors, newCors);
  content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(path, content);
  console.log('CORS updated successfully');
} else if (content.includes('localhost:5180')) {
  console.log('CORS already includes port 5180');
} else {
  console.log('Could not find CORS pattern');
}
