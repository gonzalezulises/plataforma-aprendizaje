const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseDetailPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace break-words with break-all for h1 title to handle text without natural break points
content = content.replace(
  /<h1 className="text-3xl md:text-4xl font-bold mb-4 break-words">\{course\.title\}<\/h1>/,
  '<h1 className="text-3xl md:text-4xl font-bold mb-4 break-all">{course.title}</h1>'
);

fs.writeFileSync(path, content);
console.log('CourseDetailPage.jsx updated: h1 now uses break-all instead of break-words');
