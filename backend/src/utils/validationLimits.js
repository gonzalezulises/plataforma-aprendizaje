/**
 * Maximum length validation limits for form fields
 * These limits are used for server-side validation
 */
export const MAX_LENGTHS = {
  // Forum
  FORUM_TITLE: 200,
  FORUM_CONTENT: 10000,
  FORUM_REPLY: 5000,

  // User Profile
  USER_NAME: 100,
  USER_BIO: 500,

  // Course
  COURSE_TITLE: 200,
  COURSE_DESCRIPTION: 5000,

  // Webinar
  WEBINAR_TITLE: 200,
  WEBINAR_DESCRIPTION: 2000,

  // Comments
  COMMENT_CONTENT: 2000,

  // Search
  SEARCH_QUERY: 500,

  // General text
  SHORT_TEXT: 100,
  MEDIUM_TEXT: 500,
  LONG_TEXT: 2000,
  VERY_LONG_TEXT: 10000
};

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}

/**
 * Validate text length
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error message
 * @returns {{ valid: boolean, error?: string }} - Validation result
 */
export function validateLength(text, maxLength, fieldName) {
  if (!text) {
    return { valid: true };
  }
  if (text.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} excede el limite de ${maxLength} caracteres (${text.length} caracteres)`
    };
  }
  return { valid: true };
}
