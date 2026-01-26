const fs = require('fs');

const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/CodeChallengePage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the line numbers overlay - add height constraint
content = content.replace(
  /<div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none">/g,
  '<div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none h-[300px] sm:h-[350px] lg:h-[400px] overflow-hidden">'
);

// Also update the comment if needed
content = content.replace(
  '{/* Line numbers overlay with syntax error highlighting */}',
  '{/* Line numbers overlay - responsive height contained within editor (Feature #208) */}'
);

fs.writeFileSync(filePath, content);
console.log('Fixed line numbers overlay height constraint');
