const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseDetailPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Add overflow-hidden to the Course Info column to prevent children overflow
content = content.replace(
  /<div className="md:col-span-2">/g,
  '<div className="md:col-span-2 min-w-0 overflow-hidden">'
);

// Fix 2: Add overflow-x-hidden to the main container
content = content.replace(
  /<div className="min-h-screen bg-gray-50 dark:bg-gray-900">/,
  '<div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">'
);

// Fix 3: Add min-w-0 to the hero section grid container
content = content.replace(
  /<div className="grid md:grid-cols-3 gap-8">/,
  '<div className="grid md:grid-cols-3 gap-8 min-w-0">'
);

fs.writeFileSync(path, content);
console.log('CourseDetailPage.jsx updated with overflow fixes for Feature #210');
