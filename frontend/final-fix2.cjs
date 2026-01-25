const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseCreatorPage.jsx';

// Read current content
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings to LF for matching, then convert back
const originalLineEndings = content.includes('\r\n') ? 'CRLF' : 'LF';
content = content.replace(/\r\n/g, '\n');

// Check if changes already applied
if (content.includes('Generar con IA')) {
  console.log('Button already exists, skipping button update');
} else {
  // Replace the single button with two buttons in a flex container
  const oldButtonPattern = `              <button
                onClick={() => {
                  setModuleForm({ title: '', description: '', bloom_objective: '' });
                  setEditingModule(null);
                  setShowModuleModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Agregar Modulo
              </button>
            </div>

            {/* Modules List */}`;

  const newButtonPattern = `              <div className="flex gap-2">
                <button
                  onClick={() => setShowAICourseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Generar con IA
                </button>
                <button
                  onClick={() => {
                    setModuleForm({ title: '', description: '', bloom_objective: '' });
                    setEditingModule(null);
                    setShowModuleModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar Modulo
                </button>
              </div>
            </div>

            {/* Modules List */}`;

  if (content.includes(oldButtonPattern)) {
    content = content.replace(oldButtonPattern, newButtonPattern);
    console.log('Button section updated successfully');
  } else {
    console.log('Could not find button pattern');
  }
}

// Check if modal already exists
if (content.includes('<AICourseStructureModal')) {
  console.log('Modal already exists, skipping modal update');
} else {
  // Add the modal at the end before closing div
  const oldEnd = `      {/* AI Quiz Generator Modal */}
      <AIQuizGeneratorModal
        isOpen={showAIQuizModal}
        onClose={() => {
          setShowAIQuizModal(false);
          setAIQuizLessonId(null);
          setAIQuizLessonTitle('');
        }}
        lessonId={aiQuizLessonId}
        lessonTitle={aiQuizLessonTitle}
        onQuizSaved={(quizId) => {
          toast.success(\`Quiz #\${quizId} creado con exito\`);
          // Optionally refresh the lesson data
        }}
      />
    </div>
  );
}`;

  const newEnd = `      {/* AI Quiz Generator Modal */}
      <AIQuizGeneratorModal
        isOpen={showAIQuizModal}
        onClose={() => {
          setShowAIQuizModal(false);
          setAIQuizLessonId(null);
          setAIQuizLessonTitle('');
        }}
        lessonId={aiQuizLessonId}
        lessonTitle={aiQuizLessonTitle}
        onQuizSaved={(quizId) => {
          toast.success(\`Quiz #\${quizId} creado con exito\`);
          // Optionally refresh the lesson data
        }}
      />

      {/* AI Course Structure Modal */}
      <AICourseStructureModal
        isOpen={showAICourseModal}
        onClose={() => setShowAICourseModal(false)}
        courseId={course?.id}
        onStructureApplied={(result) => {
          toast.success(\`Estructura aplicada: \${result.totalModules} modulos y \${result.totalLessons} lecciones creadas\`);
          loadCourse();
          setShowAICourseModal(false);
        }}
      />
    </div>
  );
}`;

  if (content.includes(oldEnd)) {
    content = content.replace(oldEnd, newEnd);
    console.log('Modal added successfully');
  } else {
    console.log('Could not find end pattern');
  }
}

// Convert back to original line endings if needed
if (originalLineEndings === 'CRLF') {
  content = content.replace(/\n/g, '\r\n');
}

// Write the file
fs.writeFileSync(path, content);
console.log('File written');

// Verify the changes
const verifyContent = fs.readFileSync(path, 'utf8');
if (verifyContent.includes('Generar con IA') && verifyContent.includes('<AICourseStructureModal')) {
  console.log('SUCCESS: All changes verified');
} else {
  console.log('WARNING: Some changes may not have been applied');
  console.log('Has button:', verifyContent.includes('Generar con IA'));
  console.log('Has modal:', verifyContent.includes('<AICourseStructureModal'));
}
