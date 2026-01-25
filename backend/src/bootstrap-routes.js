// Bootstrap additional routes
// This file should be imported after app is created

export async function bootstrapRoutes(app) {
  console.log('Bootstrapping additional routes...');

  // Load projects routes
  try {
    const projectsModule = await import('./routes/projects.js');
    app.use('/api/projects', projectsModule.default);
    console.log('  - Projects routes: LOADED');
  } catch (e) {
    console.error('  - Projects routes: FAILED -', e.message);
  }

  // Load feedback routes
  try {
    const feedbackModule = await import('./routes/feedback.js');
    app.use('/api/feedback', feedbackModule.default);
    console.log('  - Feedback routes: LOADED');
  } catch (e) {
    console.error('  - Feedback routes: FAILED -', e.message);
  }

  console.log('Route bootstrapping complete');
}
