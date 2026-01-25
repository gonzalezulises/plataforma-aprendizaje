import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix onClick={saveCourse} to onClick={() => saveCourse()} to avoid passing event as argument
content = content.replace(/onClick=\{saveCourse\}/g, 'onClick={() => saveCourse()}');

fs.writeFileSync(filePath, content);
console.log('Fixed onClick handlers');
