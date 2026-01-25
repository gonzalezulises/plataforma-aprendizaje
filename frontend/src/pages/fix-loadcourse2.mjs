import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Use a regex to match the pattern more flexibly
const pattern = /(\s+const data = await response\.json\(\);\s+setCourse\(data\.course\);)(\s+setCourseForm\(\{)/;

if (!content.includes('setCourseVersion(data.course.updated_at); // Store version')) {
  content = content.replace(pattern, '$1\n      setCourseVersion(data.course.updated_at); // Store version for conflict detection$2');
  fs.writeFileSync(filePath, content);
  console.log('Added setCourseVersion in loadCourse');
} else {
  console.log('Already patched');
}
