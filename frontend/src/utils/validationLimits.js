/**
 * Maximum length validation limits for form fields
 * These limits are used for client-side validation and should match server-side limits
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
 * Get character count display string
 * @param {number} current - Current length
 * @param {number} max - Maximum length
 * @returns {string} - Display string like "150/200"
 */
export function getCharCountDisplay(current, max) {
  return `${current}/${max}`;
}

/**
 * Check if text is approaching limit (80%+)
 * @param {number} current - Current length
 * @param {number} max - Maximum length
 * @returns {boolean} - True if approaching limit
 */
export function isApproachingLimit(current, max) {
  return current >= max * 0.8;
}

/**
 * Check if text exceeds limit
 * @param {number} current - Current length
 * @param {number} max - Maximum length
 * @returns {boolean} - True if exceeds limit
 */
export function exceedsLimit(current, max) {
  return current > max;
}

/**
 * Get CSS classes for character counter based on status
 * @param {number} current - Current length
 * @param {number} max - Maximum length
 * @returns {string} - Tailwind CSS classes
 */
export function getCharCountClasses(current, max) {
  if (current > max) {
    return 'text-red-500 dark:text-red-400 font-medium';
  }
  if (current >= max * 0.9) {
    return 'text-orange-500 dark:text-orange-400';
  }
  if (current >= max * 0.8) {
    return 'text-yellow-600 dark:text-yellow-400';
  }
  return 'text-gray-400 dark:text-gray-500';
}
