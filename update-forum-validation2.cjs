const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Check if already updated
if (content.includes('MIN_TITLE_LENGTH')) {
  console.log('ALREADY_UPDATED: File already contains minimum length validation');
  process.exit(0);
}

// Look for the specific function signature
const marker = 'const handleFieldChange = (field, value) => {';
if (!content.includes(marker)) {
  console.log('NOT_FOUND: Could not find handleFieldChange');
  process.exit(1);
}

// Replace the handleFieldChange function
const oldHandleFieldChange = `const handleFieldChange = (field, value) => {
    setNewThread({ ...newThread, [field]: value });
    // Clear error for this field if user starts typing
    if (value.trim() && fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };`;

const newHandleFieldChange = `// Minimum length constants for validation
  const MIN_TITLE_LENGTH = 5;
  const MIN_CONTENT_LENGTH = 10;

  // Clear field error when user starts typing (and meets minimum length)
  const handleFieldChange = (field, value) => {
    setNewThread({ ...newThread, [field]: value });
    // Clear error for this field if user meets the requirements
    if (fieldErrors[field]) {
      const trimmedValue = value.trim();
      if (field === 'title' && trimmedValue.length >= MIN_TITLE_LENGTH) {
        setFieldErrors(prev => ({ ...prev, [field]: '' }));
      } else if (field === 'content' && trimmedValue.length >= MIN_CONTENT_LENGTH) {
        setFieldErrors(prev => ({ ...prev, [field]: '' }));
      }
    }
  };`;

if (content.includes(oldHandleFieldChange)) {
  content = content.replace(oldHandleFieldChange, newHandleFieldChange);
  console.log('Replaced handleFieldChange');
} else {
  console.log('handleFieldChange pattern not found exactly');
  // Try a more flexible approach - look for lines separately
  const lines = content.split('\n');
  let inFunction = false;
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleFieldChange = (field, value)')) {
      startLine = i;
      inFunction = true;
    }
    if (inFunction && lines[i].trim() === '};' && startLine !== -1) {
      endLine = i;
      break;
    }
  }

  if (startLine !== -1 && endLine !== -1) {
    console.log('Found function at lines ' + startLine + ' to ' + endLine);
    // Find comment line before
    if (lines[startLine - 1].includes('Clear field error')) {
      startLine = startLine - 1;
    }
    const newLines = newHandleFieldChange.split('\n');
    lines.splice(startLine, endLine - startLine + 1, ...newLines);
    content = lines.join('\n');
    console.log('Replaced using line-by-line approach');
  } else {
    console.log('Could not find function boundaries');
  }
}

// Replace the validation in handleCreateThread
const oldValidation = `if (!newThread.title.trim()) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    }
    if (!newThread.content.trim()) {
      errors.content = 'El contenido es requerido';
      hasErrors = true;
    }`;

const newValidation = `if (!trimmedTitle) {
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
  console.log('Replaced validation logic');
} else {
  console.log('Validation pattern not found');
}

// Add trimmed variables after hasErrors declaration
const oldHasErrors = `let hasErrors = false;

    if (!newThread.title.trim())`;

const newHasErrors = `let hasErrors = false;
    const trimmedTitle = newThread.title.trim();
    const trimmedContent = newThread.content.trim();

    if (!trimmedTitle)`;

if (content.includes(oldHasErrors)) {
  content = content.replace(oldHasErrors, newHasErrors);
  console.log('Added trimmed variables');
} else {
  console.log('Could not find hasErrors pattern');
}

// Update the comment
content = content.replace(
  '// Validate required fields and set field-level errors',
  '// Validate required fields and minimum length'
);

// Update error message
content = content.replace(
  "toast.error('Por favor completa los campos requeridos')",
  "toast.error('Por favor corrige los errores en el formulario')"
);

fs.writeFileSync(filePath, content);
console.log('SUCCESS: File updated');
