// Feature #231: Bootstrap script to mount quiz import routes
// Run this after the server starts: node quiz-import-bootstrap.js

import('./src/index.js').then(appModule => {
  const app = appModule.default;
  import('./src/routes/quiz-import.js').then(quizImportModule => {
    app.use('/api/quizzes/import', quizImportModule.default);
    console.log('[Bootstrap] Quiz import routes mounted at /api/quizzes/import');
  });
}).catch(err => {
  console.error('[Bootstrap] Error:', err);
});
