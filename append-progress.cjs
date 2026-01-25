const fs = require('fs');
const update = fs.readFileSync('C:/Users/gonza/claude-projects/progress-update-95.txt', 'utf8');
fs.appendFileSync('C:/Users/gonza/claude-projects/claude-progress.txt', update);
console.log('Progress update appended');
