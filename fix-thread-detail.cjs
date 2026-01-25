const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/ThreadDetailPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add useAuth import after useWebSocket import
content = content.replace(
  "import useWebSocket from '../hooks/useWebSocket';",
  "import useWebSocket from '../hooks/useWebSocket';\nimport { useAuth } from '../store/AuthContext';"
);

// Replace the getUser function and user/isOwner/isInstructor with useAuth
content = content.replace(
  /\/\/ Get user from session\/localStorage[\s\S]*?const isInstructor = user && user\.role === 'instructor_admin';/,
  `// Get user from AuthContext
  const { user } = useAuth();
  const isOwner = user && thread && (String(user.id) === String(thread.user_id));
  const isInstructor = user && user.role === 'instructor_admin';`
);

fs.writeFileSync(filePath, content);
console.log('File updated successfully');
