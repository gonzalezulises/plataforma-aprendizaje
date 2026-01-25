// Start the server with additional routes loaded
// This script loads the main server and adds projects and feedback routes

import express from 'express';

// First, import the main app
const app = (await import('./src/index.js')).default;

// Load additional routes after a delay to ensure app is ready
setTimeout(async () => {
  try {
    // Projects routes
    const projectsModule = await import('./src/routes/projects.js');
    app.use('/api/projects', projectsModule.default);
    console.log('[start-with-routes] Projects routes loaded at /api/projects');
  } catch (e) {
    console.error('[start-with-routes] Failed to load projects routes:', e.message);
  }

  try {
    // Feedback routes
    const feedbackModule = await import('./src/routes/feedback.js');
    app.use('/api/feedback', feedbackModule.default);
    console.log('[start-with-routes] Feedback routes loaded at /api/feedback');
  } catch (e) {
    console.error('[start-with-routes] Failed to load feedback routes:', e.message);
  }
}, 2000);
