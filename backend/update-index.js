const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/index.js';
let content = fs.readFileSync(path, 'utf8');

// Add import after career-paths import
const importLine = "import careerPathsRoutes, { initCareerPathsTables } from './routes/career-paths.js';";
const newImport = importLine + "\nimport aiCourseStructureRoutes from './routes/ai-course-structure.js';";
content = content.replace(importLine, newImport);

// Add route registration after career-paths route
const routeLine = "app.use('/api/career-paths', careerPathsRoutes);";
const newRoute = routeLine + "\napp.use('/api/ai', aiCourseStructureRoutes);";
content = content.replace(routeLine, newRoute);

fs.writeFileSync(path, content);
console.log('File updated successfully');
