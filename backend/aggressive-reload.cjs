// Aggressive reload - touch multiple files
const fs = require('fs');

const files = [
  'C:/Users/gonza/claude-projects/backend/src/index.js',
  'C:/Users/gonza/claude-projects/backend/src/routes/courses.js',
  'C:/Users/gonza/claude-projects/backend/src/utils/searchUtils.js'
];

const timestamp = new Date().toISOString();

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add or update a reload marker comment at the end
    const marker = /\/\/ RELOAD_MARKER: .*/;
    const newMarker = `// RELOAD_MARKER: ${timestamp}`;

    if (marker.test(content)) {
      content = content.replace(marker, newMarker);
    } else {
      content = content + `\n${newMarker}\n`;
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  } catch (err) {
    console.log(`Error with ${filePath}:`, err.message);
  }
});

console.log('\nTouched all files at:', timestamp);
console.log('Nodemon should reload now...');
