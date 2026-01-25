const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
let content = fs.readFileSync(path, 'utf8');

// Add debug logging
const oldCode = `    // Feature #179: Handle quoted phrase search
    if (search) {
      const { exactPhrases, words } = parseSearchQuery(search);`;

const newCode = `    // Feature #179: Handle quoted phrase search
    if (search) {
      console.log('[DEBUG #179] Raw search query:', JSON.stringify(search));
      const { exactPhrases, words } = parseSearchQuery(search);
      console.log('[DEBUG #179] Parsed:', { exactPhrases, words });`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content);
  console.log('Debug logging added');
} else if (content.includes('[DEBUG #179]')) {
  console.log('Debug logging already present');
} else {
  console.log('Could not find target code');
}
