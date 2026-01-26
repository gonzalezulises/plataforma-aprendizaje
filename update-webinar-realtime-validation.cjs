const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/frontend/src/pages/WebinarSchedulePage.jsx';

let content = fs.readFileSync(path, 'utf8');

// Normalize line endings
const normalizedContent = content.replace(/\r\n/g, '\n');

const oldCode = `  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field if user starts typing
    if (value && fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };`;

const newCode = `  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Real-time validation feedback as user types
    if (name === 'title') {
      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        // Show "required" error if user deleted all content
        if (value.length > 0 && trimmedValue.length === 0) {
          setFieldErrors(prev => ({ ...prev, title: 'El titulo es requerido' }));
        }
      } else {
        // Valid - clear error
        setFieldErrors(prev => ({ ...prev, title: '' }));
      }
    } else {
      // For other fields, just clear error when valid
      if (value && fieldErrors[name]) {
        setFieldErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };`;

if (normalizedContent.includes(oldCode)) {
  let updatedContent = normalizedContent.replace(oldCode, newCode);
  // Convert back to CRLF for Windows
  updatedContent = updatedContent.replace(/\n/g, '\r\n');
  fs.writeFileSync(path, updatedContent);
  console.log('WebinarSchedulePage.jsx updated successfully with real-time validation');
} else {
  console.log('Old code not found in file');
  if (normalizedContent.includes('Real-time validation feedback as user types')) {
    console.log('Real-time validation already implemented!');
  }
}
