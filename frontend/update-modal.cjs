const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/components/AICourseStructureModal.jsx';
let content = fs.readFileSync(path, 'utf8');

// Fix generate endpoint
content = content.replace(
  '`${API_BASE}/api/courses/ai/generate-structure`',
  '`${API_BASE}/api/ai/generate-course-structure`'
);

// Fix apply endpoint
content = content.replace(
  '`${API_BASE}/api/courses/${courseId}/ai/apply-structure`',
  '`${API_BASE}/api/ai/apply-course-structure/${courseId}`'
);

fs.writeFileSync(path, content);
console.log('Modal endpoints updated successfully');
