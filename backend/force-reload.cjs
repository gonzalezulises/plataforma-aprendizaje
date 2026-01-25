// Force reload by modifying courses.js
const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
let content = fs.readFileSync(path, 'utf8');

const timestamp = new Date().toISOString();

// Update the console.log timestamp
const oldPattern = /console\.log\('Courses routes loading[^']*'\);/;
const newLog = `console.log('Courses routes loading... (Feature #179 - ${timestamp})');`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newLog);
  fs.writeFileSync(path, content);
  console.log('Updated courses.js with timestamp:', timestamp);
} else {
  console.log('Could not find log statement');
}
