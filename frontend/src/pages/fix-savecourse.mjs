import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');

// Read file
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace using a regex that's more flexible with whitespace
const pattern = /(\s+)const response = await fetch\(url, \{\s*method: course \? 'PUT' : 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*credentials: 'include',\s*body: JSON\.stringify\(courseForm\)\s*\}\);(\s*)if \(!response\.ok\) \{\s*const error = await response\.json\(\);\s*throw new Error\(error\.error \|\| 'Failed to save course'\);\s*\}(\s*)const data = await response\.json\(\);\s*setCourse\(data\.course\);\s*toast\.success\(course \? 'Curso actualizado' : 'Curso creado'\);/;

const replacement = `$1// Include version for optimistic locking when updating
      const bodyData = course
        ? { ...courseForm, version: courseVersion }
        : courseForm;

      const response = await fetch(url, {
        method: course ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyData)
      });

      // Handle 409 Conflict - concurrent edit detected
      if (response.status === 409) {
        const conflictResponse = await response.json();
        setConflictData(conflictResponse.conflict);
        setShowConflictModal(true);
        return null;
      }
$2if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }
$3const data = await response.json();
      setCourse(data.course);
      setCourseVersion(data.course.updated_at); // Update version after save
      toast.success(course ? 'Curso actualizado' : 'Curso creado');`;

if (pattern.test(content)) {
  content = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, content);
  console.log('SUCCESS: saveCourse function patched with version and 409 handling');
} else if (content.includes('body: JSON.stringify(bodyData)')) {
  console.log('Already patched');
} else {
  // Try a simpler line-by-line approach
  console.log('Pattern not matched, trying line-by-line approach...');

  // Replace body: JSON.stringify(courseForm) with bodyData version
  if (content.includes('body: JSON.stringify(courseForm)') && !content.includes('const bodyData = course')) {
    // Find the specific section we need to modify
    const lines = content.split('\n');
    let modified = false;
    let inSaveCourse = false;
    let saveCourseStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('const saveCourse = async')) {
        inSaveCourse = true;
        saveCourseStart = i;
      }
      if (inSaveCourse && lines[i].includes('const response = await fetch(url,')) {
        // Insert bodyData definition before this line
        const indent = lines[i].match(/^\s*/)[0];
        lines.splice(i, 0,
          indent + '// Include version for optimistic locking when updating',
          indent + 'const bodyData = course',
          indent + '  ? { ...courseForm, version: courseVersion }',
          indent + '  : courseForm;',
          ''
        );
        i += 5;
      }
      if (inSaveCourse && lines[i].includes('body: JSON.stringify(courseForm)')) {
        lines[i] = lines[i].replace('JSON.stringify(courseForm)', 'JSON.stringify(bodyData)');
        modified = true;
      }
      if (inSaveCourse && lines[i].includes('if (!response.ok)')) {
        // Insert 409 handling before this
        const indent = lines[i].match(/^\s*/)[0];
        lines.splice(i, 0,
          indent + '// Handle 409 Conflict - concurrent edit detected',
          indent + 'if (response.status === 409) {',
          indent + '  const conflictResponse = await response.json();',
          indent + '  setConflictData(conflictResponse.conflict);',
          indent + '  setShowConflictModal(true);',
          indent + '  return null;',
          indent + '}',
          ''
        );
        i += 8;
      }
      if (inSaveCourse && lines[i].includes('setCourse(data.course);') && !lines[i+1]?.includes('setCourseVersion')) {
        // Add version update after setCourse
        const indent = lines[i].match(/^\s*/)[0];
        lines.splice(i+1, 0, indent + 'setCourseVersion(data.course.updated_at); // Update version after save');
        inSaveCourse = false; // We're done with saveCourse
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log('SUCCESS: patched using line-by-line approach');
    } else {
      console.log('Could not patch - please check file manually');
    }
  } else {
    console.log('Could not find the code to patch');
  }
}
