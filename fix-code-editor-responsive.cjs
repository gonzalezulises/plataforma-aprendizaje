const fs = require('fs');

const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/CodeChallengePage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Add overflow-hidden to the editor container
content = content.replace(
  'className="flex-1 relative">',
  'className="flex-1 relative overflow-hidden">'
);

// Fix 2: Make textarea height responsive and add left padding for line numbers
content = content.replace(
  'className={`w-full h-[400px] p-4 font-mono text-sm bg-gray-900 text-green-400 resize-none focus:outline-none ${',
  'className={`w-full h-[300px] sm:h-[350px] lg:h-[400px] p-4 pl-12 font-mono text-sm bg-gray-900 text-green-400 resize-none focus:outline-none overflow-auto ${'
);

// Fix 3: Add height constraint to line numbers overlay
content = content.replace(
  '{/* Line numbers overlay with syntax error highlighting */}\n              <div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none">',
  '{/* Line numbers overlay - responsive height contained within editor (Feature #208) */}\n              <div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none h-[300px] sm:h-[350px] lg:h-[400px] overflow-hidden">'
);

// Fix 4: Adjust line number width
content = content.replace(
  'className={`h-5 text-right pr-4 w-8 ${',
  'className={`h-5 text-right pr-2 w-10 ${'
);

// Fix 5: Adjust error icon position
content = content.replace(
  '<span className="absolute left-10 text-red-400"',
  '<span className="absolute left-12 text-red-400"'
);

fs.writeFileSync(filePath, content);
console.log('Fixed CodeChallengePage.jsx for responsive code editor (Feature #208)');
