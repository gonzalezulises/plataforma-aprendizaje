const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');

// Add init call
if (!content.includes('initLessonCommentsTables(db)')) {
  content = content.replace(
    'initUploadsTables(db);',
    'initUploadsTables(db);\n  // Initialize lesson comments tables\n  initLessonCommentsTables(db);'
  );
  fs.writeFileSync(path, content);
  console.log('Added init call');
} else {
  console.log('Init call already exists');
}
