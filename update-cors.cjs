const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');
const oldOrigins = "'http://localhost:5183'";
const newOrigins = `'http://localhost:5183',
      'http://localhost:5184',
      'http://localhost:5185',
      'http://localhost:5186',
      'http://localhost:5187',
      'http://localhost:5188',
      'http://localhost:5189',
      'http://localhost:5190',
      'http://localhost:5191',
      'http://localhost:5192',
      'http://localhost:5193',
      'http://localhost:5194',
      'http://localhost:5195'`;
if (content.includes("'http://localhost:5190'")) {
  console.log('Port 5190 already in CORS list');
} else {
  content = content.replace(oldOrigins, newOrigins);
  fs.writeFileSync(path, content);
  console.log('Updated CORS list');
}
