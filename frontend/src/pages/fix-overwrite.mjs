import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update saveCourse to accept an optional version override
const oldSaveCourseSignature = 'const saveCourse = async () => {';
const newSaveCourseSignature = 'const saveCourse = async (overrideVersion = null) => {';

if (content.includes(oldSaveCourseSignature)) {
  content = content.replace(oldSaveCourseSignature, newSaveCourseSignature);
  console.log('Updated saveCourse signature to accept overrideVersion');
}

// 2. Update the version used in bodyData
const oldVersionLine = '? { ...courseForm, version: courseVersion }';
const newVersionLine = '? { ...courseForm, version: overrideVersion || courseVersion }';

if (content.includes(oldVersionLine)) {
  content = content.replace(oldVersionLine, newVersionLine);
  console.log('Updated bodyData to use overrideVersion');
}

// 3. Update the overwrite button to pass the version directly
const oldOverwriteHandler = `onClick={async () => {
                  setCourseVersion(conflictData.currentVersion);
                  setShowConflictModal(false);
                  setConflictData(null);
                  setTimeout(() => saveCourse(), 100);
                }}`;

const newOverwriteHandler = `onClick={async () => {
                  const newVersion = conflictData.currentVersion;
                  setShowConflictModal(false);
                  setConflictData(null);
                  setCourseVersion(newVersion);
                  // Pass version directly to avoid React state timing issues
                  saveCourse(newVersion);
                }}`;

if (content.includes(oldOverwriteHandler)) {
  content = content.replace(oldOverwriteHandler, newOverwriteHandler);
  console.log('Updated overwrite button to pass version directly');
}

fs.writeFileSync(filePath, content);
console.log('Done!');
