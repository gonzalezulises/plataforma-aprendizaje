const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseCreatorPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add the AI button next to "Agregar Modulo"
const oldButtonSection = `            {/* Add Module Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Modulos del Curso
              </h2>
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
            </div>`;

const newButtonSection = `            {/* Add Module Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Modulos del Curso
              </h2>
              <div className="flex gap-2">
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
            </div>`;

if (content.includes(oldButtonSection)) {
  content = content.replace(oldButtonSection, newButtonSection);
  console.log('Button section updated');
} else {
  console.log('Button section already updated or not found');
}

// 2. Add the AI Course Structure Modal component at the end before closing div
const oldAIQuizModal = `      {/* AI Quiz Generator Modal */}
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

const newAIQuizModal = `      {/* AI Quiz Generator Modal */}
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

if (content.includes(oldAIQuizModal) && !content.includes('<AICourseStructureModal')) {
  content = content.replace(oldAIQuizModal, newAIQuizModal);
  console.log('AI Course Structure Modal added');
} else if (content.includes('<AICourseStructureModal')) {
  console.log('AI Course Structure Modal already exists');
} else {
  console.log('Could not find location to add modal');
}

fs.writeFileSync(path, content);
console.log('CourseCreatorPage.jsx updated successfully');
