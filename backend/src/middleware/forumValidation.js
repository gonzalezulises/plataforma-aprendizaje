/**
 * Forum validation middleware (Feature #188 - Maximum length validation)
 * Validates maximum length on forum-related inputs
 */

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const MAX_REPLY_LENGTH = 5000;

/**
 * Middleware to validate forum thread creation
 */
export function validateForumThread(req, res, next) {
  const { title, content } = req.body || {};

  if (title && title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({
      error: `El titulo excede el limite de ${MAX_TITLE_LENGTH} caracteres (${title.length} caracteres)`,
      field: 'title',
      maxLength: MAX_TITLE_LENGTH,
      currentLength: title.length
    });
  }

  if (content && content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({
      error: `El contenido excede el limite de ${MAX_CONTENT_LENGTH} caracteres (${content.length} caracteres)`,
      field: 'content',
      maxLength: MAX_CONTENT_LENGTH,
      currentLength: content.length
    });
  }

  next();
}

/**
 * Middleware to validate forum reply
 */
export function validateForumReply(req, res, next) {
  const { content } = req.body || {};

  if (content && content.length > MAX_REPLY_LENGTH) {
    return res.status(400).json({
      error: `El contenido de la respuesta excede el limite de ${MAX_REPLY_LENGTH} caracteres (${content.length} caracteres)`,
      field: 'content',
      maxLength: MAX_REPLY_LENGTH,
      currentLength: content.length
    });
  }

  next();
}

/**
 * General forum validation middleware that can be applied at the router level
 */
export function forumValidationMiddleware(req, res, next) {
  if (req.method !== 'POST') {
    return next();
  }

  const { title, content } = req.body || {};

  // Thread creation paths (course/:id/thread)
  if (req.path.match(/\/course\/\d+\/thread$/) || req.originalUrl.match(/\/course\/\d+\/thread$/)) {
    if (title && title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        error: `El titulo excede el limite de ${MAX_TITLE_LENGTH} caracteres (${title.length} caracteres)`
      });
    }
    if (content && content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `El contenido excede el limite de ${MAX_CONTENT_LENGTH} caracteres (${content.length} caracteres)`
      });
    }
  }

  // Reply paths (thread/:id/reply)
  if (req.path.match(/\/thread\/\d+\/reply$/) || req.originalUrl.match(/\/thread\/\d+\/reply$/)) {
    if (content && content.length > MAX_REPLY_LENGTH) {
      return res.status(400).json({
        error: `El contenido de la respuesta excede el limite de ${MAX_REPLY_LENGTH} caracteres (${content.length} caracteres)`
      });
    }
  }

  next();
}

export default {
  validateForumThread,
  validateForumReply,
  forumValidationMiddleware,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_REPLY_LENGTH
};
