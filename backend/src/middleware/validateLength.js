import { MAX_LENGTHS } from '../utils/validationLimits.js';

/**
 * Middleware to validate maximum length on request body fields
 * @param {Object} fieldLimits - Object mapping field names to their max lengths
 * @returns {Function} Express middleware function
 */
export function validateLengthMiddleware(fieldLimits) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, maxLength] of Object.entries(fieldLimits)) {
      const value = req.body[field];
      if (value && typeof value === 'string' && value.length > maxLength) {
        errors.push(`${field} excede el limite de ${maxLength} caracteres (${value.length} caracteres)`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: errors.join(', '),
        validationErrors: errors
      });
    }

    next();
  };
}

/**
 * Pre-configured validators for common entities
 */
export const forumThreadValidator = validateLengthMiddleware({
  title: MAX_LENGTHS.FORUM_TITLE,
  content: MAX_LENGTHS.FORUM_CONTENT
});

export const forumReplyValidator = validateLengthMiddleware({
  content: MAX_LENGTHS.FORUM_REPLY
});

export const courseValidator = validateLengthMiddleware({
  title: MAX_LENGTHS.COURSE_TITLE,
  description: MAX_LENGTHS.COURSE_DESCRIPTION
});

export const webinarValidator = validateLengthMiddleware({
  title: MAX_LENGTHS.WEBINAR_TITLE,
  description: MAX_LENGTHS.WEBINAR_DESCRIPTION
});
