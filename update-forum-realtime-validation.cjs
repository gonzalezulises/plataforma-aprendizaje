const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';

let content = fs.readFileSync(path, 'utf8');

// Normalize line endings - convert CRLF to LF for matching
const normalizedContent = content.replace(/\r\n/g, '\n');

const oldCode = `  const handleFieldChange = (field, value) => {
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

const newCode = `  const handleFieldChange = (field, value) => {
    setNewThread({ ...newThread, [field]: value });

    // Real-time validation - show errors as user types, clear when valid
    const trimmedValue = value.trim();

    if (field === 'title') {
      if (trimmedValue.length === 0) {
        // Only show "required" error if user has started typing and deleted all
        if (value.length > 0 && trimmedValue.length === 0) {
          setFieldErrors(prev => ({ ...prev, title: 'El titulo es requerido' }));
        }
      } else if (trimmedValue.length < MIN_TITLE_LENGTH) {
        setFieldErrors(prev => ({
          ...prev,
          title: \`El titulo debe tener al menos \${MIN_TITLE_LENGTH} caracteres (\${trimmedValue.length}/\${MIN_TITLE_LENGTH})\`
        }));
      } else {
        // Valid - clear error
        setFieldErrors(prev => ({ ...prev, title: '' }));
      }
    } else if (field === 'content') {
      if (trimmedValue.length === 0) {
        // Only show "required" error if user has started typing and deleted all
        if (value.length > 0 && trimmedValue.length === 0) {
          setFieldErrors(prev => ({ ...prev, content: 'El contenido es requerido' }));
        }
      } else if (trimmedValue.length < MIN_CONTENT_LENGTH) {
        setFieldErrors(prev => ({
          ...prev,
          content: \`El contenido debe tener al menos \${MIN_CONTENT_LENGTH} caracteres (\${trimmedValue.length}/\${MIN_CONTENT_LENGTH})\`
        }));
      } else {
        // Valid - clear error
        setFieldErrors(prev => ({ ...prev, content: '' }));
      }
    }
  };`;

if (normalizedContent.includes(oldCode)) {
  // Replace in normalized content then convert back to CRLF (Windows)
  let updatedContent = normalizedContent.replace(oldCode, newCode);
  // Convert back to CRLF for Windows
  updatedContent = updatedContent.replace(/\n/g, '\r\n');
  fs.writeFileSync(path, updatedContent);
  console.log('ForumPage.jsx updated successfully with real-time validation');
} else {
  console.log('Old code not found in file');
  // Check if new code exists
  if (normalizedContent.includes('Real-time validation - show errors as user types')) {
    console.log('Real-time validation already implemented!');
  } else {
    console.log('Content check:');
    console.log('Has "const handleFieldChange":', normalizedContent.includes('const handleFieldChange'));
    console.log('Has "Clear error for this field":', normalizedContent.includes('Clear error for this field'));
  }
}
