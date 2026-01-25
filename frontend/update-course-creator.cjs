const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseCreatorPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import for AICourseStructureModal
content = content.replace(
  "import AIQuizGeneratorModal from '../components/AIQuizGeneratorModal';",
  "import AIQuizGeneratorModal from '../components/AIQuizGeneratorModal';\nimport AICourseStructureModal from '../components/AICourseStructureModal';"
);

// 2. Add state for AI Course Structure Modal (after AI Quiz Generator modal state)
content = content.replace(
  "const [aiQuizLessonTitle, setAIQuizLessonTitle] = useState('');",
  "const [aiQuizLessonTitle, setAIQuizLessonTitle] = useState('');\n\n  // AI Course Structure Generator modal state\n  const [showAICourseModal, setShowAICourseModal] = useState(false);"
);

// 3. Add callback for when structure is applied
const structureAppliedCallback = `
  // Handle AI-generated structure applied
  const handleStructureApplied = (generatedModules) => {
    // Reload course to get updated modules
    loadCourse();
  };
`;

// Find where to insert the callback (after loadCourse function)
content = content.replace(
  "useEffect(() => {\n    if (courseId) {",
  structureAppliedCallback + "\n  useEffect(() => {\n    if (courseId) {"
);

// 4. Add AI Structure button in Modules tab header
content = content.replace(
  `<div className="flex justify-between items-center">
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
              >`,
  `<div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Modulos del Curso
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAICourseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors"
                  title="Usar IA para generar estructura"
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
                >`
);

// 5. Close the extra div for the button container
content = content.replace(
  `Agregar Modulo
              </button>
            </div>

            {/* Modules List */}`,
  `Agregar Modulo
                </button>
              </div>
            </div>

            {/* Modules List */}`
);

// 6. Add AI Course Structure Modal at the end (before closing div)
content = content.replace(
  `{/* AI Quiz Generator Modal */}
      <AIQuizGeneratorModal`,
  `{/* AI Course Structure Generator Modal */}
      <AICourseStructureModal
        isOpen={showAICourseModal}
        onClose={() => setShowAICourseModal(false)}
        courseId={course?.id}
        onStructureApplied={handleStructureApplied}
      />

      {/* AI Quiz Generator Modal */}
      <AIQuizGeneratorModal`
);

fs.writeFileSync(path, content);
console.log('CourseCreatorPage updated with AI Course Structure Modal integration');
