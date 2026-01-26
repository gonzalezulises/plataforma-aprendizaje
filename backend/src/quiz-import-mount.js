// Feature #231: Auto-mount script for quiz import routes
// This script is designed to be run after the server starts
// It dynamically adds the quiz import routes to the Express app

// Wait for the app to be available, then mount the routes
const mountQuizImportRoutes = async () => {
  try {
    // Import the main app module
    const appModule = await import('./index.js');
    const app = appModule.default;

    // Import the quiz import routes
    const quizImportModule = await import('./routes/quiz-import.js');

    // Mount the routes
    app.use('/api/quizzes/import', quizImportModule.default);

    console.log('[Feature #231] Quiz import routes mounted successfully');
  } catch (error) {
    console.error('[Feature #231] Failed to mount quiz import routes:', error);
  }
};

// Export for potential use
export { mountQuizImportRoutes };

// Auto-execute if this is the main module
mountQuizImportRoutes();
