const fs = require('fs');
const content = fs.readFileSync('C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx', 'utf8');
const lines = content.split('\n');
lines.slice(152, 170).forEach((l, i) => console.log((153+i) + '|' + JSON.stringify(l)));
