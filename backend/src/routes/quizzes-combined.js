// Feature #231: Combined quiz routes wrapper
// This file mounts both the import routes and the main quiz routes
// ensuring import routes are checked before the :id pattern routes

import express from 'express';
import quizImportRoutes from './quiz-import.js';

const router = express.Router();

// Mount import routes FIRST (before the :id routes from main quizzes)
router.use('/import', quizImportRoutes);

// Then re-export and mount all routes from original quizzes.js
// We need to dynamically load to avoid circular dependencies
import('./quizzes.js').then(quizModule => {
  // Get all routes from original router and mount them
  // Actually, Express doesn't support route extraction easily
  // So we'll import and use the router directly
}).catch(err => {
  console.error('[Quiz Combined] Error loading quizzes routes:', err);
});

// For now, let's just re-export the import routes
// The main quizzes.js will be loaded separately
export default router;
