// Feature #231: Quiz Import Route Initializer
// This file is loaded by the main index and adds import routes to the quizzes router

import quizImportRoutes from './quiz-import.js';

/**
 * Initialize quiz import routes on the main Express app
 * @param {Express} app - The Express application
 */
export function initQuizImportRoutes(app) {
  // Mount import routes BEFORE the general /api/quizzes routes
  // to ensure /api/quizzes/import/... paths are caught before /:id routes
  app.use('/api/quizzes/import', quizImportRoutes);
  console.log('[Quiz Import] Routes mounted at /api/quizzes/import');
}

export default { initQuizImportRoutes };
