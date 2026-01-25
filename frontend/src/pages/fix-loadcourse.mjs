import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const pattern = `setCourse(data.course);
      setCourseForm({`;

const replacement = `setCourse(data.course);
      setCourseVersion(data.course.updated_at); // Store version for conflict detection
      setCourseForm({`;

if (content.includes(pattern) && !content.includes('setCourseVersion(data.course.updated_at); // Store version')) {
  content = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, content);
  console.log('Added setCourseVersion in loadCourse');
} else if (content.includes('setCourseVersion(data.course.updated_at); // Store version')) {
  console.log('Already patched');
} else {
  console.log('Pattern not found');
}
