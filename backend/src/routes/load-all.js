// Route loader - loads projects and feedback routes
// This file is imported by a single route to add all additional routes

import projectsRoutes from './projects.js';
import feedbackRoutes from './feedback.js';

export function loadAdditionalRoutes(app) {
  app.use('/api/projects', projectsRoutes);
  app.use('/api/feedback', feedbackRoutes);
  console.log('Additional routes loaded (projects, feedback)');
}

export { projectsRoutes, feedbackRoutes };
