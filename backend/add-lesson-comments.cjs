const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');

// Add import
if (!content.includes('lesson-comments.js')) {
  content = content.replace(
    "import instructorsRoutes from './routes/instructors.js';",
    "import instructorsRoutes from './routes/instructors.js';\nimport lessonCommentsRoutes, { initLessonCommentsTables } from './routes/lesson-comments.js';"
  );
  console.log('Added import');
}

// Add init call
if (!content.includes('initLessonCommentsTables')) {
  content = content.replace(
    'initUploadsTables(db);',
    'initUploadsTables(db);\n  // Initialize lesson comments tables\n  initLessonCommentsTables(db);'
  );
  console.log('Added init call');
}

// Add route
if (!content.includes('/api/lesson-comments')) {
  content = content.replace(
    "app.use('/api/instructors', instructorsRoutes);",
    "app.use('/api/instructors', instructorsRoutes);\napp.use('/api/lesson-comments', lessonCommentsRoutes);"
  );
  console.log('Added route');
}

fs.writeFileSync(path, content);
console.log('index.js updated successfully');
