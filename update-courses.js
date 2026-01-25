const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/courses.js';
let content = fs.readFileSync(path, 'utf8');

// Debug: print what we're looking for
const searchStr = '// Delete course (cascades to modules, lessons, content)';
console.log('Found search string at index:', content.indexOf(searchStr));

// Find and replace the specific section
const oldPattern = /\/\/ Delete course \(cascades to modules, lessons, content\)\s*\n\s*run\('DELETE FROM courses WHERE id = \?', \[id\]\);/;
const newCode = `// Delete related data that may not have CASCADE constraints
    // 1. Delete enrollments for this course
    run('DELETE FROM enrollments WHERE course_id = ?', [id]);

    // 2. Delete lesson progress for lessons in this course
    const lessonIds = queryAll(\`
      SELECT l.id FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
    \`, [id]).map(r => r.id);

    if (lessonIds.length > 0) {
      const placeholders = lessonIds.map(() => '?').join(',');
      run(\`DELETE FROM lesson_progress WHERE lesson_id IN (\${placeholders})\`, lessonIds);
      run(\`DELETE FROM video_progress WHERE lesson_id IN (\${placeholders})\`, lessonIds);
    }

    // 3. Delete forum threads for this course (if they exist)
    run('DELETE FROM forum_threads WHERE course_id = ?', [id]);

    // 4. Delete course (cascades to modules, lessons, content via foreign keys)
    run('DELETE FROM courses WHERE id = ?', [id]);`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log('File updated successfully');
} else {
  console.log('Pattern not found - trying alternative approach');
  // Show what's actually around the delete statement
  const idx = content.indexOf(searchStr);
  if (idx > -1) {
    console.log('Context around match:');
    console.log(JSON.stringify(content.substring(idx - 10, idx + 100)));
  }
}
