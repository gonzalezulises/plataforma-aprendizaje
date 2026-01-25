const fs = require('fs');
const c = fs.readFileSync('C:/Users/gonza/claude-projects/frontend/src/pages/CourseCreatorPage.jsx', 'utf8');

// Find the button section
const buttonIndex = c.indexOf('Agregar Modulo');
if (buttonIndex > -1) {
  console.log('=== BUTTON CONTEXT (300 chars before, 100 after) ===');
  console.log(c.slice(Math.max(0, buttonIndex - 300), buttonIndex + 100));
  console.log('\n=== END BUTTON CONTEXT ===');
}

// Find the quiz modal section
const quizIndex = c.indexOf('AIQuizGeneratorModal');
if (quizIndex > -1) {
  // Find the last occurrence (the component usage, not import)
  const lastQuizIndex = c.lastIndexOf('AIQuizGeneratorModal');
  console.log('\n=== QUIZ MODAL END CONTEXT (100 chars before, 300 after) ===');
  console.log(c.slice(Math.max(0, lastQuizIndex - 100), lastQuizIndex + 300));
  console.log('\n=== END QUIZ MODAL CONTEXT ===');
}

// Check line endings
const hasCarriageReturn = c.includes('\r\n');
console.log('\nLine endings: ', hasCarriageReturn ? 'CRLF (Windows)' : 'LF (Unix)');
