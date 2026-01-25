const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Check if already has trimmed variables
if (content.includes('const trimmedTitle = newThread.title.trim()')) {
  console.log('ALREADY_UPDATED: File already has trimmed variables');
  process.exit(0);
}

// Replace the validation in handleCreateThread
const oldValidation = `// Validate required fields and minimum length
    const errors = { title: '', content: '' };
    let hasErrors = false;

    if (!newThread.title.trim()) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    }
    if (!newThread.content.trim()) {
      errors.content = 'El contenido es requerido';
      hasErrors = true;
    }`;

const newValidation = `// Validate required fields and minimum length
    const errors = { title: '', content: '' };
    let hasErrors = false;
    const trimmedTitle = newThread.title.trim();
    const trimmedContent = newThread.content.trim();

    if (!trimmedTitle) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    } else if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      errors.title = \`El titulo debe tener al menos \${MIN_TITLE_LENGTH} caracteres\`;
      hasErrors = true;
    }

    if (!trimmedContent) {
      errors.content = 'El contenido es requerido';
      hasErrors = true;
    } else if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      errors.content = \`El contenido debe tener al menos \${MIN_CONTENT_LENGTH} caracteres\`;
      hasErrors = true;
    }`;

if (content.includes(oldValidation)) {
  content = content.replace(oldValidation, newValidation);
  fs.writeFileSync(filePath, content);
  console.log('SUCCESS: Updated validation logic');
} else {
  console.log('NOT_FOUND: Validation pattern not found');
  console.log('Looking for pattern starting at line...');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Validate required fields')) {
      console.log('Line ' + i + ': ' + lines[i]);
      console.log('Next lines:');
      for (let j = i; j < i + 15 && j < lines.length; j++) {
        console.log(j + ': ' + JSON.stringify(lines[j]));
      }
      break;
    }
  }
}
