const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `// Clear field error when user starts typing
  const handleFieldChange = (field, value) => {
    setNewThread({ ...newThread, [field]: value });
    // Clear error for this field if user starts typing
    if (value.trim() && fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();

    // Validate required fields and set field-level errors
    const errors = { title: '', content: '' };
    let hasErrors = false;

    if (!newThread.title.trim()) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    }
    if (!newThread.content.trim()) {
      errors.content = 'El contenido es requerido';
      hasErrors = true;
    }

    setFieldErrors(errors);

    if (hasErrors) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }`;

const newCode = `// Minimum length constants for validation
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
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();

    // Validate required fields and minimum length
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
    }

    setFieldErrors(errors);

    if (hasErrors) {
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content);
  console.log('SUCCESS: Updated validation in ForumPage.jsx');
} else if (content.includes('MIN_TITLE_LENGTH')) {
  console.log('ALREADY_UPDATED: File already contains minimum length validation');
} else {
  console.log('NOT_FOUND: Could not find the code to replace');
}
