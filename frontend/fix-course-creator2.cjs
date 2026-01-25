const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/CourseCreatorPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add AI button - find the Agregar Modulo button section
if (!content.includes('Generar con IA')) {
  // Find the pattern and replace
  const oldPattern = `              <button
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

  const newPattern = `              <div className="flex gap-2">
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

  if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    console.log('Button section updated');
  } else {
    console.log('Could not find exact button pattern, trying alternate approach...');
    // Try simpler replacement
    content = content.replace(
      /(<button\s+onClick=\{\(\) => \{\s+setModuleForm[^}]+\}\s+setEditingModule\(null\);\s+setShowModuleModal\(true\);\s+\}\}\s+className="flex items-center gap-2 px-4 py-2 bg-primary-600[^>]+>\s+<svg[^>]+>[^<]+<\/svg>\s+Agregar Modulo\s+<\/button>)(\s+<\/div>\s+{\/* Modules List)/,
      `<div className="flex gap-2">
                <button
                  onClick={() => setShowAICourseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Generar con IA
                </button>
                $1
              </div>$2`
    );
  }
}

// 2. Add the modal at the end
if (!content.includes('<AICourseStructureModal')) {
  content = content.replace(
    '      />\n    </div>\n  );\n}',
    `      />

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
}`
  );
  console.log('Modal added');
}

fs.writeFileSync(path, content);
console.log('Done!');
