import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'CourseCreatorPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update the saveCourse function to include version and handle 409
const oldFetchBlock = `      const response = await fetch(url, {
        method: course ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(courseForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }

      const data = await response.json();
      setCourse(data.course);
      toast.success(course ? 'Curso actualizado' : 'Curso creado');`;

const newFetchBlock = `      // Include version for optimistic locking when updating
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }

      const data = await response.json();
      setCourse(data.course);
      setCourseVersion(data.course.updated_at); // Update version after save
      toast.success(course ? 'Curso actualizado' : 'Curso creado');`;

if (content.includes(oldFetchBlock)) {
  content = content.replace(oldFetchBlock, newFetchBlock);
  console.log('Updated saveCourse function with version and 409 handling');
} else if (content.includes('body: JSON.stringify(bodyData)')) {
  console.log('saveCourse already patched');
} else {
  console.log('saveCourse pattern not found - checking current state...');
  // Show what we have
  const fetchMatch = content.match(/body: JSON\.stringify\((.*?)\)/);
  if (fetchMatch) {
    console.log('Current body:', fetchMatch[0]);
  }
}

// 2. Update loadCourse to store version
const loadCourseOld = `      setCourse(data.course);
      setCourseForm({`;

const loadCourseNew = `      setCourse(data.course);
      setCourseVersion(data.course.updated_at); // Store version for conflict detection
      setCourseForm({`;

if (content.includes(loadCourseOld) && !content.includes('setCourseVersion(data.course.updated_at)')) {
  content = content.replace(loadCourseOld, loadCourseNew);
  console.log('Updated loadCourse to store version');
} else if (content.includes('setCourseVersion(data.course.updated_at)')) {
  console.log('loadCourse already patched');
}

// 3. Add conflict modal before AI Quiz Generator Modal
const conflictModal = `
      {/* Conflict Resolution Modal */}
      {showConflictModal && conflictData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Conflicto de Edicion
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Otro usuario modifico este curso mientras lo editabas
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Datos actuales en el servidor:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li><strong>Titulo:</strong> {conflictData.currentData?.title}</li>
                <li><strong>Categoria:</strong> {conflictData.currentData?.category}</li>
                <li><strong>Nivel:</strong> {conflictData.currentData?.level}</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Puedes sobrescribir con tus cambios o recargar para ver los cambios del otro usuario.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictData(null);
                  loadCourse();
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Recargar Datos
              </button>
              <button
                onClick={async () => {
                  setCourseVersion(conflictData.currentVersion);
                  setShowConflictModal(false);
                  setConflictData(null);
                  setTimeout(() => saveCourse(), 100);
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Sobrescribir
              </button>
            </div>
          </div>
        </div>
      )}

`;

// Find the AI Quiz Generator Modal and insert conflict modal before it
if (!content.includes('Conflicto de Edicion') && content.includes('{/* AI Quiz Generator Modal */}')) {
  content = content.replace(
    '{/* AI Quiz Generator Modal */',
    conflictModal + '      {/* AI Quiz Generator Modal */'
  );
  console.log('Added conflict modal');
} else if (content.includes('Conflicto de Edicion')) {
  console.log('Conflict modal already exists');
}

fs.writeFileSync(filePath, content);
console.log('Done! CourseCreatorPage.jsx patched.');
