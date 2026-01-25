// Add middleware to log incoming search params
const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
let content = fs.readFileSync(path, 'utf8');

// Add a simple console.log right at the beginning of the route
const oldCode = `router.get('/', (req, res) => {`;
const newCode = `router.get('/', (req, res) => {
  console.log('[DEBUG #179] req.query:', req.query);
  console.log('[DEBUG #179] typeof search:', typeof req.query.search);
  console.log('[DEBUG #179] search value:', JSON.stringify(req.query.search));`;

if (content.includes('[DEBUG #179] req.query:')) {
  console.log('Debug logging already present at route start');
} else if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content);
  console.log('Added debug logging at route start');
} else {
  console.log('Could not find route start');
}
