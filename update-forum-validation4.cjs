const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Check if already has trimmed variables
if (content.includes('const trimmedTitle = newThread.title.trim()')) {
  console.log('ALREADY_UPDATED: File already has trimmed variables');
  process.exit(0);
}

// Normalize line endings for comparison
const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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

if (normalizedContent.includes(oldValidation)) {
  // Apply replacement to normalized content
  const updatedContent = normalizedContent.replace(oldValidation, newValidation);
  // Write with original line endings (CRLF for Windows)
  fs.writeFileSync(filePath, updatedContent.replace(/\n/g, '\r\n'));
  console.log('SUCCESS: Updated validation logic');
} else {
  console.log('NOT_FOUND: Validation pattern not found after normalization');
}
