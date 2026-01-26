const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/LessonPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Add import for LessonComments
if (!content.includes('LessonComments')) {
  content = content.replace(
    "import CourseSidebar from '../components/CourseSidebar';",
    "import CourseSidebar from '../components/CourseSidebar';\nimport LessonComments from '../components/LessonComments';"
  );
  console.log('Added LessonComments import');
}

// Add LessonComments component before the navigation buttons section
// Find the pattern for the navigation section and add comments before it
if (!content.includes('<LessonComments')) {
  content = content.replace(
    '{/* Navigation buttons */}',
    '{/* Lesson Comments - Feature #74 */}\n        <LessonComments lessonId={currentLessonId} />\n\n        {/* Navigation buttons */}'
  );
  console.log('Added LessonComments component');
}

fs.writeFileSync(path, content);
console.log('LessonPage.jsx updated successfully');
