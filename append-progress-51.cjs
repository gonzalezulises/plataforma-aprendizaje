const fs = require('fs');
const progressUpdate = fs.readFileSync('C:/Users/gonza/claude-projects/progress-update-51.txt', 'utf8');
fs.appendFileSync('C:/Users/gonza/claude-projects/claude-progress.txt', progressUpdate);
console.log('Progress appended successfully');
